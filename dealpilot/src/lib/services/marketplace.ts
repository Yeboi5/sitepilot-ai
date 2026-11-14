import { getCategory, isCategory, validateCategoryFields } from "../domain/categories";
import type { Cents } from "../domain/money";
import { compareOffers, isCustomerVisible, type ReviewStats } from "../domain/offers";
import { offerEligibility } from "../domain/verification";
import type { Review } from "../domain/types";

export function reviewStats(rs: Review[]): ReviewStats {
  return { count: rs.length, average: rs.length ? rs.reduce((a, r) => a + r.rating, 0) / rs.length : 0 };
}
import {
  businessMatchesRequest, canViewOffer, canViewRequest, ForbiddenError, NotFoundError, requireRole, ValidationError,
} from "../domain/permissions";
import type { Actor, Business, Offer, PurchaseRequest, Recurrence } from "../domain/types";
import { audit, newId, notify, type Ctx } from "./context";

// ─── Customer requests ───────────────────────────────────────────────────────

export interface CreateRequestInput {
  categoryId: string;
  title: string;
  description: string;
  region: string;
  baselineCents: Cents;
  recurrence: Recurrence;
  fields: Record<string, unknown>;
  documentId?: string;
  /** Demo: ask simulated providers to bid so the comparison isn't empty. */
  simulateBids?: boolean;
}

export async function createRequest(ctx: Ctx, actor: Actor, input: CreateRequestInput): Promise<PurchaseRequest> {
  requireRole(actor, "customer");
  if (!isCategory(input.categoryId)) throw new ValidationError("Choose a category");
  const title = input.title.trim().slice(0, 140);
  if (title.length < 4) throw new ValidationError("Give your request a short title");
  if (!Number.isInteger(input.baselineCents) || input.baselineCents <= 0) throw new ValidationError("Enter your current price or quote");
  const fields = validateCategoryFields(input.categoryId, input.fields);
  if (!fields.ok) throw new ValidationError(Object.values(fields.errors).join(". "));
  if (input.documentId) {
    const doc = await ctx.store.get("documents", input.documentId);
    if (!doc || doc.ownerId !== actor.userId) throw new ForbiddenError("That document isn't yours");
    if (!doc.confirmedAt) throw new ValidationError("Review and confirm the details extracted from your document first");
  }
  const now = ctx.now();
  const req: PurchaseRequest = {
    id: newId(), customerId: actor.userId, categoryId: input.categoryId, title, description: input.description.trim().slice(0, 2000),
    region: input.region.trim().slice(0, 80) || "Australia-wide", fields: fields.fields, baselineCents: input.baselineCents,
    recurrence: input.recurrence, documentId: input.documentId, status: "open", closesAt: new Date(now.getTime() + 14 * 86_400_000).toISOString(),
    isDemo: false, createdAt: now.toISOString(),
  };
  await ctx.store.insert("requests", req);
  await audit(ctx, actor, "request.created", "request", req.id, { categoryId: req.categoryId });

  // Notify real businesses that match category and region.
  const businesses = await ctx.store.list("businesses");
  for (const b of businesses.filter((b) => !b.isSimulated && b.ownerId && businessMatchesRequest(b, req))) {
    await notify(ctx, b.ownerId!, { kind: "offer", title: `New request: ${req.title}`, body: `${getCategory(req.categoryId).name} in ${req.region}.`, href: `/biz/requests/${req.id}` });
  }
  if (input.simulateBids) await simulateMarketBids(ctx, req);
  return req;
}

/**
 * SIMULATED: fictional providers respond so the comparison can be demonstrated.
 * Offers are flagged isSimulated and labelled in the UI.
 */
export async function simulateMarketBids(ctx: Ctx, req: PurchaseRequest): Promise<Offer[]> {
  const category = getCategory(req.categoryId);
  const now = ctx.now();
  const profiles = [
    { name: "Value Pro Services (simulated)", factor: category.simulatedBenchmark.low, warranty: 12, days: 5, insured: false, licence: undefined },
    { name: "Premier Choice Co (simulated)", factor: (category.simulatedBenchmark.low + category.simulatedBenchmark.high) / 2, warranty: 36, days: 8, insured: true, licence: "SIM-LIC-0001" },
    { name: "Reliable & Local (simulated)", factor: category.simulatedBenchmark.high, warranty: 60, days: 10, insured: true, licence: "SIM-LIC-0002" },
  ];
  const out: Offer[] = [];
  for (const p of profiles) {
    const business: Business = {
      id: newId(), name: p.name, description: "Simulated provider for demonstrations.", categories: [req.categoryId], regions: [req.region],
      qualifications: p.licence ? ["Licensed (simulated)"] : [], licenceNumber: p.licence, insured: p.insured, reviewCount: 0, reviewsVerified: false, isSimulated: true, verificationStatus: "unverified", createdAt: now.toISOString(),
    };
    await ctx.store.insert("businesses", business);
    const offer: Offer = {
      id: newId(), requestId: req.id, businessId: business.id, status: "submitted", priceCents: Math.round((req.baselineCents * p.factor) / 100) * 100,
      recurrence: req.recurrence, scope: req.title, materials: "As requested", warrantyMonths: category.id === "trades" || category.id === "retail" ? p.warranty : 0,
      completionDays: p.days, includesInsurance: p.insured, aiDrafted: false, validUntil: new Date(now.getTime() + 14 * 86_400_000).toISOString(),
      isSimulated: true, createdAt: now.toISOString(), updatedAt: now.toISOString(),
    };
    await ctx.store.insert("offers", offer);
    out.push(offer);
  }
  await audit(ctx, "system", "offers.simulated", "request", req.id, { count: out.length });
  return out;
}

export async function listCustomerRequests(ctx: Ctx, actor: Actor) {
  requireRole(actor, "customer");
  const reqs = await ctx.store.list("requests", { customerId: actor.userId });
  return reqs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getRequestForCustomer(ctx: Ctx, actor: Actor, id: string) {
  const req = await ctx.store.get("requests", id);
  if (!req) throw new NotFoundError("Request");
  if (!canViewRequest(actor, req)) throw new ForbiddenError();
  const now = ctx.now();
  const businesses = new Map((await ctx.store.list("businesses")).map((b) => [b.id, b]));
  const offers = (await ctx.store.list("offers", { requestId: id })).filter((o) => {
    const b = businesses.get(o.businessId);
    if (b && !o.isSimulated && b.verificationStatus === "suspended" && o.status !== "accepted") return false;
    return isCustomerVisible(o, now, b) || ["accepted", "declined", "countered"].includes(o.status);
  });
  const category = getCategory(req.categoryId);
  const businessIds = [...new Set(offers.map((o) => o.businessId))];
  const credentials = new Map(await Promise.all(businessIds.map(async (bid) => [bid, await ctx.store.list("credentials", { businessId: bid })] as const)));
  const reviews = new Map(await Promise.all(businessIds.map(async (bid) => [bid, reviewStats(await ctx.store.list("reviews", { businessId: bid }))] as const)));
  const comparison = compareOffers(offers.filter((o) => o.status !== "declined"), businesses, category, { credentials, reviews, now });
  const negotiations = (await ctx.store.list("negotiations", { requestId: id })).filter((n) => n.customerId === actor.userId || actor.role === "admin");
  const document = req.documentId ? await ctx.store.get("documents", req.documentId) : undefined;
  return { request: req, category, comparison, negotiations, document };
}

export async function cancelRequest(ctx: Ctx, actor: Actor, id: string) {
  const req = await ctx.store.get("requests", id);
  if (!req) throw new NotFoundError("Request");
  if (req.customerId !== actor.userId) throw new ForbiddenError();
  if (req.status === "completed") throw new ValidationError("Completed requests can't be cancelled");
  await ctx.store.update("requests", id, { status: "cancelled" });
  await audit(ctx, actor, "request.cancelled", "request", id);
}

// ─── Business side ───────────────────────────────────────────────────────────

async function myBusiness(ctx: Ctx, actor: Actor): Promise<Business> {
  requireRole(actor, "business");
  if (!actor.businessId) throw new ForbiddenError("Register your business first");
  const b = await ctx.store.get("businesses", actor.businessId);
  if (!b || b.ownerId !== actor.userId) throw new ForbiddenError();
  return b;
}
export { myBusiness };

export async function listRequestsForBusiness(ctx: Ctx, actor: Actor) {
  const b = await myBusiness(ctx, actor);
  const reqs = (await ctx.store.list("requests")).filter((r) => ["open", "negotiating"].includes(r.status) && businessMatchesRequest(b, r));
  const myOffers = (await ctx.store.list("offers", { businessId: b.id }));
  return reqs
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((r) => ({ request: r, myOffer: myOffers.find((o) => o.requestId === r.id) }));
}

export async function getRequestForBusiness(ctx: Ctx, actor: Actor, id: string) {
  const b = await myBusiness(ctx, actor);
  const req = await ctx.store.get("requests", id);
  if (!req) throw new NotFoundError("Request");
  const myOffer = (await ctx.store.list("offers", { requestId: id, businessId: b.id }))[0];
  if (!canViewRequest(actor, req, b) && !myOffer) throw new ForbiddenError();
  // Sealed bidding: businesses see the number of competing offers, never their prices or the customer's identity.
  const competing = (await ctx.store.list("offers", { requestId: id })).filter((o) => o.businessId !== b.id && o.status !== "draft").length;
  const { customerId: _customerId, documentId: _documentId, ...publicRequest } = req;
  return { business: b, request: publicRequest, category: getCategory(req.categoryId), myOffer, competing };
}

export interface OfferInput {
  priceCents: Cents;
  scope: string;
  materials: string;
  warrantyMonths: number;
  completionDays: number;
  includesInsurance: boolean;
  validDays: number;
}

function validateOffer(i: OfferInput) {
  if (!Number.isInteger(i.priceCents) || i.priceCents <= 0) throw new ValidationError("Enter a price");
  if (!i.scope.trim()) throw new ValidationError("Describe the scope");
  if (!Number.isInteger(i.warrantyMonths) || i.warrantyMonths < 0 || i.warrantyMonths > 600) throw new ValidationError("Warranty must be 0–600 months");
  if (!Number.isInteger(i.completionDays) || i.completionDays < 0 || i.completionDays > 365) throw new ValidationError("Completion must be 0–365 days");
  if (!Number.isInteger(i.validDays) || i.validDays < 1 || i.validDays > 90) throw new ValidationError("Validity must be 1–90 days");
}

/** AI drafts a bid. It is saved as a DRAFT and is invisible to customers until a person approves it. */
export async function draftBidWithAI(ctx: Ctx, actor: Actor, requestId: string) {
  const { business, category } = await getRequestForBusiness(ctx, actor, requestId);
  const req = (await ctx.store.get("requests", requestId))!;
  const draft = await ctx.ai.draftBid({ request: req, business, category });
  await audit(ctx, actor, "offer.ai_drafted", "request", requestId, { provider: ctx.ai.name });
  return { ...draft, provider: ctx.ai.name, simulated: ctx.ai.simulated };
}

/** A real business user submits (and thereby approves) an offer. */
export async function submitOffer(ctx: Ctx, actor: Actor, requestId: string, input: OfferInput & { aiDrafted: boolean }): Promise<Offer> {
  const { business, request, category } = await getRequestForBusiness(ctx, actor, requestId);
  if (!["open", "negotiating"].includes(request.status)) throw new ValidationError("This request is no longer accepting offers");
  // Only verified businesses with current credentials can submit genuine offers.
  const eligibility = offerEligibility(business, await ctx.store.list("credentials", { businessId: business.id }), category, ctx.now());
  if (!eligibility.eligible) throw new ForbiddenError(eligibility.reasons.join(". "));
  validateOffer(input);
  const existing = (await ctx.store.list("offers", { requestId, businessId: business.id }))[0];
  if (existing && !["draft", "withdrawn", "expired"].includes(existing.status)) throw new ValidationError("You already have an active offer — respond in the negotiation inbox instead");
  const now = ctx.now().toISOString();
  const offer: Offer = {
    id: existing?.id ?? newId(), requestId, businessId: business.id, status: "submitted", priceCents: input.priceCents, recurrence: request.recurrence,
    scope: input.scope.trim().slice(0, 2000), materials: input.materials.trim().slice(0, 500), warrantyMonths: input.warrantyMonths,
    completionDays: input.completionDays, includesInsurance: input.includesInsurance && business.insured, aiDrafted: input.aiDrafted,
    approvedByUserId: actor.userId, approvedAt: now, validUntil: new Date(ctx.now().getTime() + input.validDays * 86_400_000).toISOString(),
    isSimulated: false, createdAt: existing?.createdAt ?? now, updatedAt: now,
  };
  if (existing) await ctx.store.update("offers", existing.id, offer);
  else await ctx.store.insert("offers", offer);
  const full = (await ctx.store.get("requests", requestId))!;
  await notify(ctx, full.customerId, { kind: "offer", title: `New offer from ${business.name}`, body: `For "${full.title}".`, href: `/app/requests/${requestId}` });
  await audit(ctx, actor, "offer.submitted", "offer", offer.id, { priceCents: offer.priceCents, aiDrafted: offer.aiDrafted });
  return offer;
}

export async function withdrawOffer(ctx: Ctx, actor: Actor, offerId: string) {
  const b = await myBusiness(ctx, actor);
  const offer = await ctx.store.get("offers", offerId);
  if (!offer || offer.businessId !== b.id) throw new NotFoundError("Offer");
  if (offer.status === "accepted") throw new ValidationError("Accepted offers can't be withdrawn here — contact the customer");
  await ctx.store.update("offers", offerId, { status: "withdrawn", updatedAt: ctx.now().toISOString() });
  await audit(ctx, actor, "offer.withdrawn", "offer", offerId);
}

export async function getOfferForActor(ctx: Ctx, actor: Actor, offerId: string) {
  const offer = await ctx.store.get("offers", offerId);
  if (!offer) throw new NotFoundError("Offer");
  const req = await ctx.store.get("requests", offer.requestId);
  if (!req || !canViewOffer(actor, offer, req)) throw new ForbiddenError();
  return { offer, request: req };
}
