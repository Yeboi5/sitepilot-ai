import { abrClient, type AbrClient } from "../integrations/abr";
import { ForbiddenError, NotFoundError, requireRole, ValidationError } from "../domain/permissions";
import type { Actor, Business, BusinessCredential, Review, VerificationStatus } from "../domain/types";
import { credentialState, isValidAbnChecksum, normaliseAbn, verificationBlockers } from "../domain/verification";
import { audit, newId, notify, type Ctx } from "./context";
import { storeDocument } from "./documents";
import { myBusiness } from "./marketplace";

/**
 * Business verification. Nothing a business submits verifies it: an ABN is checked against the
 * register (or confirmed by an administrator), each credential is reviewed by an administrator
 * (or a register lookup), and only an administrator can mark a business verified.
 */

// ─── Business side ───────────────────────────────────────────────────────────

export async function submitAbn(ctx: Ctx, actor: Actor, rawAbn: string, abr: AbrClient = abrClient()): Promise<Business> {
  const b = await myBusiness(ctx, actor);
  const abn = normaliseAbn(rawAbn);
  if (!/^\d{11}$/.test(abn)) throw new ValidationError("An ABN has 11 digits");
  const now = ctx.now().toISOString();
  if (!isValidAbnChecksum(abn)) {
    await ctx.store.update("businesses", b.id, { abn, abnStatus: "invalid", abnCheckedAt: now });
    throw new ValidationError("That ABN isn't valid — please check the number");
  }
  const patch: Partial<Business> = { abn, abnStatus: "checksum_valid", abnCheckedAt: now, abnEntityName: undefined };
  const r = await abr.lookup(abn);
  if (r.ok) Object.assign(patch, { abnStatus: r.status === "active" ? "abr_active" : "abr_cancelled", abnEntityName: r.entityName });
  else if (r.reason === "not_found") patch.abnStatus = "abr_not_found";
  // Changing the ABN of a verified business sends it back for review.
  if (b.verificationStatus === "verified" && b.abn !== abn) Object.assign(patch, { verificationStatus: "pending", statusReason: "ABN changed — re-verification required" });
  const updated = await ctx.store.update("businesses", b.id, patch);
  await audit(ctx, actor, "business.abn_submitted", "business", b.id, { abnStatus: patch.abnStatus, abrConfigured: abr.configured, abrError: r.ok ? undefined : r.reason });
  return updated;
}

export interface CredentialInput {
  kind: BusinessCredential["kind"];
  reference: string;
  issuer: string;
  jurisdiction: string;
  expiresAt?: string;
  evidence?: { filename: string; mimeType: string; data: Uint8Array };
}

export async function addCredential(ctx: Ctx, actor: Actor, input: CredentialInput): Promise<BusinessCredential> {
  const b = await myBusiness(ctx, actor);
  if (!["licence", "insurance"].includes(input.kind)) throw new ValidationError("Choose licence or insurance");
  const reference = input.reference.trim().slice(0, 80);
  if (!reference) throw new ValidationError(input.kind === "licence" ? "Enter the licence number" : "Enter the policy number");
  if (input.expiresAt && isNaN(Date.parse(input.expiresAt))) throw new ValidationError("Enter a valid expiry date");
  if (input.kind === "insurance" && !input.expiresAt) throw new ValidationError("Insurance needs an expiry date");
  if (input.expiresAt && new Date(input.expiresAt) < ctx.now()) throw new ValidationError("That credential has already expired");
  let evidenceDocumentId: string | undefined;
  if (input.evidence) {
    const doc = await storeDocument(ctx, actor, { ...input.evidence, categoryId: "custom", kind: "certificate" }, { analyse: false });
    evidenceDocumentId = doc.id;
  }
  const c: BusinessCredential = {
    id: newId(), businessId: b.id, kind: input.kind, reference, issuer: input.issuer.trim().slice(0, 120), jurisdiction: input.jurisdiction.trim().slice(0, 40),
    expiresAt: input.expiresAt ? new Date(input.expiresAt).toISOString() : undefined, evidenceDocumentId, status: "submitted", createdAt: ctx.now().toISOString(),
  };
  await ctx.store.insert("credentials", c);
  await audit(ctx, actor, "business.credential_submitted", "credential", c.id, { kind: c.kind, hasEvidence: !!evidenceDocumentId });
  return c;
}

export async function requestVerification(ctx: Ctx, actor: Actor): Promise<Business> {
  const b = await myBusiness(ctx, actor);
  if (b.verificationStatus === "verified") throw new ValidationError("Your business is already verified");
  if (b.verificationStatus === "suspended") throw new ValidationError("Suspended businesses must contact support");
  if (!b.abn) throw new ValidationError("Add your ABN first");
  const updated = await ctx.store.update("businesses", b.id, { verificationStatus: "pending", statusReason: undefined });
  for (const admin of await ctx.store.list("users", { role: "admin" })) {
    await notify(ctx, admin.id, { kind: "guardian", title: `Verification requested: ${b.name}`, body: "Review the ABN and credentials.", href: `/admin/businesses/${b.id}` });
  }
  await audit(ctx, actor, "business.verification_requested", "business", b.id);
  return updated;
}

export async function myVerification(ctx: Ctx, actor: Actor) {
  const b = await myBusiness(ctx, actor);
  const credentials = await ctx.store.list("credentials", { businessId: b.id });
  return { business: b, credentials, blockers: verificationBlockers(b, credentials, ctx.now()), licence: credentialState(credentials, "licence", ctx.now()), insurance: credentialState(credentials, "insurance", ctx.now()) };
}

// ─── Administrator ───────────────────────────────────────────────────────────

export async function listBusinessesForAdmin(ctx: Ctx, actor: Actor) {
  requireRole(actor, "admin");
  const rank: Record<VerificationStatus, number> = { pending: 0, suspended: 1, unverified: 2, rejected: 3, verified: 4 };
  return (await ctx.store.list("businesses")).filter((b) => !b.isSimulated).sort((a, b) => rank[a.verificationStatus] - rank[b.verificationStatus] || a.name.localeCompare(b.name));
}

export async function getBusinessForAdmin(ctx: Ctx, actor: Actor, id: string) {
  requireRole(actor, "admin");
  const b = await ctx.store.get("businesses", id);
  if (!b) throw new NotFoundError("Business");
  const credentials = await ctx.store.list("credentials", { businessId: id });
  const owner = b.ownerId ? await ctx.store.get("users", b.ownerId) : undefined;
  const history = (await ctx.store.list("audit", { entityId: id })).sort((x, y) => y.at.localeCompare(x.at)).slice(0, 30);
  return { business: b, credentials, owner, blockers: verificationBlockers(b, credentials, ctx.now()), history };
}

/** An administrator records a decision on a credential after checking the evidence or a register. */
export async function reviewCredential(ctx: Ctx, actor: Actor, credentialId: string, decision: "verified" | "rejected", notes: string, method: "admin_document_review" | "register_lookup" = "admin_document_review") {
  requireRole(actor, "admin");
  const c = await ctx.store.get("credentials", credentialId);
  if (!c) throw new NotFoundError("Credential");
  if (decision === "verified" && method === "admin_document_review" && !c.evidenceDocumentId) throw new ValidationError("A credential can't be verified from a document review without an evidence document");
  if (!notes.trim()) throw new ValidationError("Record what you checked");
  const updated = await ctx.store.update("credentials", c.id, { status: decision, checkMethod: method, checkedBy: actor.userId, checkedAt: ctx.now().toISOString(), notes: notes.trim().slice(0, 1000) });
  await audit(ctx, actor, `credential.${decision}`, "credential", c.id, { businessId: c.businessId, method });
  return updated;
}

/** The administrator searched ABN Lookup manually (used when the ABR web service isn't configured). */
export async function confirmAbnManually(ctx: Ctx, actor: Actor, businessId: string, entityName: string) {
  requireRole(actor, "admin");
  const b = await ctx.store.get("businesses", businessId);
  if (!b?.abn) throw new ValidationError("The business hasn't provided an ABN");
  if (!isValidAbnChecksum(b.abn)) throw new ValidationError("The ABN fails the checksum — it can't be confirmed");
  if (!entityName.trim()) throw new ValidationError("Record the entity name shown on ABN Lookup");
  const updated = await ctx.store.update("businesses", b.id, { abnStatus: "admin_confirmed", abnEntityName: entityName.trim().slice(0, 200), abnCheckedAt: ctx.now().toISOString() });
  await audit(ctx, actor, "business.abn_confirmed_manually", "business", b.id, { entityName });
  return updated;
}

export async function setBusinessStatus(ctx: Ctx, actor: Actor, businessId: string, status: Exclude<VerificationStatus, "pending">, reason: string) {
  requireRole(actor, "admin");
  const b = await ctx.store.get("businesses", businessId);
  if (!b || b.isSimulated) throw new NotFoundError("Business");
  if (status === "verified") {
    const blockers = verificationBlockers(b, await ctx.store.list("credentials", { businessId }), ctx.now());
    if (blockers.length) throw new ValidationError(`Can't verify yet: ${blockers.join("; ")}`);
  }
  if ((status === "suspended" || status === "rejected") && !reason.trim()) throw new ValidationError("Give a reason — the business will see it");
  const now = ctx.now().toISOString();
  const patch: Partial<Business> = status === "verified"
    ? { verificationStatus: status, verifiedAt: now, verifiedBy: actor.userId, statusReason: reason.trim() || undefined }
    : { verificationStatus: status, statusReason: reason.trim().slice(0, 500) || undefined };
  const updated = await ctx.store.update("businesses", b.id, patch);
  await audit(ctx, actor, `business.${status}`, "business", b.id, { reason });
  if (b.ownerId) await notify(ctx, b.ownerId, { kind: "guardian", title: `Business ${status}`, body: reason || (status === "verified" ? "You can now submit offers." : ""), href: "/biz/verification" });
  return updated;
}

// ─── Reviews from verified jobs ──────────────────────────────────────────────

export async function leaveReview(ctx: Ctx, actor: Actor, transactionId: string, rating: number, comment: string): Promise<Review> {
  requireRole(actor, "customer");
  const tx = await ctx.store.get("transactions", transactionId);
  if (!tx || tx.customerId !== actor.userId) throw new NotFoundError("Transaction");
  if (tx.status !== "verified") throw new ValidationError("You can review a business once the job is verified complete");
  if (tx.simulated || !tx.businessId) throw new ValidationError("Only real jobs with a DealPilot business can be reviewed");
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new ValidationError("Choose a rating from 1 to 5");
  if ((await ctx.store.list("reviews", { transactionId })).length) throw new ValidationError("You've already reviewed this job");
  const r: Review = { id: newId(), transactionId, businessId: tx.businessId, customerId: actor.userId, rating, comment: comment.trim().slice(0, 2000), createdAt: ctx.now().toISOString() };
  await ctx.store.insert("reviews", r);
  await audit(ctx, actor, "review.created", "review", r.id, { businessId: r.businessId, rating });
  return r;
}

export async function assertAdminOrOwner(ctx: Ctx, actor: Actor, businessId: string) {
  if (actor.role === "admin") return;
  const b = await ctx.store.get("businesses", businessId);
  if (!b || b.ownerId !== actor.userId) throw new ForbiddenError();
}
