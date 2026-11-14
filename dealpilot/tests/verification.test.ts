import { describe, expect, it, vi } from "vitest";
import type { AIProvider } from "@/lib/ai/types";
import { MockAIProvider } from "@/lib/ai/mock";
import { isValidAbnChecksum } from "@/lib/domain/verification";
import { ForbiddenError } from "@/lib/domain/permissions";
import { parseAbrResponse, type AbrClient } from "@/lib/integrations/abr";
import { builtinScanner } from "@/lib/integrations/scanner";
import { signUp } from "@/lib/services/accounts";
import { InfectedFileError, uploadDocument } from "@/lib/services/documents";
import { createRequest, submitOffer } from "@/lib/services/marketplace";
import { acceptCurrentOffer, approveFinalTerms, businessRespond } from "@/lib/services/negotiations";
import { listCustomerTransactions, verifyTransaction } from "@/lib/services/transactions";
import {
  addCredential, confirmAbnManually, leaveReview, requestVerification, reviewCredential, setBusinessStatus, submitAbn,
} from "@/lib/services/verification";
import { IDS } from "@/lib/store/seed";
import { admin, alex, ben, makeCtx } from "./helpers";

const ATO_EXAMPLE_ABN = "51 824 753 556"; // the ATO's published example ABN
const pdf = new TextEncoder().encode("%PDF-1.4\n1 0 obj << >> endobj\n%%EOF");
const fakeAbr = (result: Awaited<ReturnType<AbrClient["lookup"]>>): AbrClient => ({ configured: true, lookup: async () => result });

describe("ABN validation", () => {
  it("checks the ATO checksum", () => {
    expect(isValidAbnChecksum(ATO_EXAMPLE_ABN)).toBe(true);
    expect(isValidAbnChecksum("51 824 753 557")).toBe(false);
    expect(isValidAbnChecksum("1234")).toBe(false);
  });
  it("parses ABN Lookup JSONP responses, including errors", () => {
    expect(parseAbrResponse('callback({"Abn":"51824753556","AbnStatus":"Active","EntityName":"EXAMPLE PTY LTD","BusinessName":["Example"],"Gst":"2000-07-01","Message":""})'))
      .toEqual({ ok: true, status: "active", abn: "51824753556", entityName: "EXAMPLE PTY LTD", businessNames: ["Example"], gstRegistered: true });
    expect(parseAbrResponse('callback({"Abn":"","AbnStatus":"","EntityName":"","Message":"The GUID entered is not recognised as a Registered Party"})')).toMatchObject({ ok: false, reason: "not_configured" });
    expect(parseAbrResponse("<html>")).toMatchObject({ ok: false, reason: "service_error" });
  });
});

async function newBusiness() {
  const ctx = await makeCtx();
  const u = await signUp(ctx, { name: "Pat", email: "pat@example.test", password: "a-long-password", role: "business", region: "Sydney NSW", businessName: "Pat's Fencing", categories: ["trades"] });
  return { ctx, actor: { userId: u.id, role: "business" as const, businessId: u.businessId } };
}

describe("Business verification workflow", () => {
  it("a new business starts unverified and cannot submit genuine offers", async () => {
    const { ctx, actor } = await newBusiness();
    const req = await createRequest(ctx, alex, { categoryId: "trades", title: "Fence fix", description: "", region: "Sydney NSW", baselineCents: 100_000, recurrence: "one_off", fields: { trade: "Fencing" } });
    await expect(submitOffer(ctx, actor, req.id, { priceCents: 90_000, scope: "x", materials: "", warrantyMonths: 0, completionDays: 1, includesInsurance: false, validDays: 7, aiDrafted: false })).rejects.toThrow(/not been verified/);
  });

  it("uploading documents never verifies anything; an admin must check each step", async () => {
    const { ctx, actor } = await newBusiness();
    await expect(submitAbn(ctx, actor, "51 824 753 557", fakeAbr({ ok: false, reason: "not_configured", message: "" }))).rejects.toThrow(/isn't valid/);
    const b1 = await submitAbn(ctx, actor, ATO_EXAMPLE_ABN, fakeAbr({ ok: false, reason: "not_configured", message: "" }));
    expect(b1.abnStatus).toBe("checksum_valid");
    await expect(addCredential(ctx, actor, { kind: "insurance", reference: "PL-1", issuer: "Insurer", jurisdiction: "NSW" })).rejects.toThrow(/expiry/);
    const lic = await addCredential(ctx, actor, { kind: "licence", reference: "LIC-1", issuer: "NSW Fair Trading", jurisdiction: "NSW", expiresAt: "2027-12-31", evidence: { filename: "lic.pdf", mimeType: "application/pdf", data: pdf } });
    const ins = await addCredential(ctx, actor, { kind: "insurance", reference: "PL-1", issuer: "Insurer", jurisdiction: "NSW", expiresAt: "2027-06-30", evidence: { filename: "pl.pdf", mimeType: "application/pdf", data: pdf } });
    expect(lic.status).toBe("submitted");
    await requestVerification(ctx, actor);
    expect((await ctx.store.get("businesses", actor.businessId!))?.verificationStatus).toBe("pending");

    // Not verifiable yet: ABN unconfirmed and credentials unreviewed.
    await expect(setBusinessStatus(ctx, admin, actor.businessId!, "verified", "")).rejects.toThrow(/registration hasn't been confirmed.*awaiting review/);
    await expect(setBusinessStatus(ctx, actor, actor.businessId!, "verified", "")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(reviewCredential(ctx, admin, lic.id, "verified", "")).rejects.toThrow(/Record what you checked/);
    await confirmAbnManually(ctx, admin, actor.businessId!, "PAT'S FENCING PTY LTD");
    await reviewCredential(ctx, admin, lic.id, "verified", "Licence matches NSW Fair Trading register screenshot");
    await reviewCredential(ctx, admin, ins.id, "verified", "Certificate of currency checked");
    const verified = await setBusinessStatus(ctx, admin, actor.businessId!, "verified", "");
    expect(verified).toMatchObject({ verificationStatus: "verified", verifiedBy: IDS.admin });
    const audit = await ctx.store.list("audit", { entityId: actor.businessId! });
    expect(audit.map((a) => a.action)).toEqual(expect.arrayContaining(["business.abn_confirmed_manually", "business.verified"]));
  });

  it("an active ABN Lookup result confirms the ABN without manual steps", async () => {
    const { ctx, actor } = await newBusiness();
    const b = await submitAbn(ctx, actor, ATO_EXAMPLE_ABN, fakeAbr({ ok: true, status: "active", abn: "51824753556", entityName: "PAT PTY LTD", businessNames: [], gstRegistered: true }));
    expect(b).toMatchObject({ abnStatus: "abr_active", abnEntityName: "PAT PTY LTD" });
    const cancelled = await submitAbn(ctx, actor, ATO_EXAMPLE_ABN, fakeAbr({ ok: true, status: "cancelled", abn: "51824753556", entityName: "PAT PTY LTD", businessNames: [], gstRegistered: false }));
    expect(cancelled.abnStatus).toBe("abr_cancelled");
  });

  it("credentials can't be 'verified' from a document review without evidence", async () => {
    const { ctx, actor } = await newBusiness();
    const c = await addCredential(ctx, actor, { kind: "licence", reference: "LIC-2", issuer: "x", jurisdiction: "NSW" });
    await expect(reviewCredential(ctx, admin, c.id, "verified", "looked fine")).rejects.toThrow(/without an evidence document/);
    await expect(reviewCredential(ctx, admin, c.id, "verified", "Checked on the public register", "register_lookup")).resolves.toMatchObject({ status: "verified" });
  });

  it("suspending requires a reason and is visible to the business", async () => {
    const ctx = await makeCtx();
    await expect(setBusinessStatus(ctx, admin, IDS.bBen, "suspended", "")).rejects.toThrow(/reason/);
    await setBusinessStatus(ctx, admin, IDS.bBen, "suspended", "Insurance certificate withdrawn");
    expect((await ctx.store.list("alerts", { userId: IDS.ben })).some((a) => a.title === "Business suspended")).toBe(true);
  });
});

describe("Reviews only from verified, real jobs", () => {
  it("allows one review per verified job and rejects simulated ones", async () => {
    const ctx = await makeCtx();
    await expect(leaveReview(ctx, alex, IDS.txCar, 5, "")).rejects.toThrow(/Only real jobs/);
    await businessRespond(ctx, ben, IDS.negFence, { action: "counter", priceCents: 480_000, message: "" });
    await acceptCurrentOffer(ctx, alex, IDS.negFence, true);
    await approveFinalTerms(ctx, ben, IDS.negFence, true);
    const tx = (await listCustomerTransactions(ctx, alex)).transactions.find((t) => t.negotiationId === IDS.negFence)!;
    await expect(leaveReview(ctx, alex, tx.id, 5, "")).rejects.toThrow(/verified complete/);
    await verifyTransaction(ctx, alex, tx.id, { method: "customer_confirmed_invoice", finalCents: 480_000, confirmed: true });
    await expect(leaveReview(ctx, alex, tx.id, 6, "")).rejects.toThrow(/1 to 5/);
    const r = await leaveReview(ctx, alex, tx.id, 5, "Great job");
    expect(r.businessId).toBe(IDS.bBen);
    await expect(leaveReview(ctx, alex, tx.id, 4, "")).rejects.toThrow(/already reviewed/);
  });
});

describe("Upload security", () => {
  it("blocks the EICAR test file and stores nothing", async () => {
    const ctx = await makeCtx();
    const before = (await ctx.store.list("documents")).length;
    const eicar = new TextEncoder().encode("X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*");
    await expect(uploadDocument(ctx, alex, { filename: "x.txt", mimeType: "text/plain", data: eicar, categoryId: "custom", kind: "other" })).rejects.toBeInstanceOf(InfectedFileError);
    expect((await ctx.store.list("documents")).length).toBe(before);
    expect((await ctx.store.list("audit", { action: "document.blocked_infected" }))).toHaveLength(1);
  });

  it("fails closed when the scanner is unavailable", async () => {
    const ctx = { ...(await makeCtx()), scanner: { name: "down", antivirus: true, scan: async () => { throw new Error("ECONNREFUSED"); } } };
    await expect(uploadDocument(ctx, alex, { filename: "q.txt", mimeType: "text/plain", data: new TextEncoder().encode("TOTAL: $5.00"), categoryId: "custom", kind: "quote" })).rejects.toThrow(/couldn't scan/);
  });

  it("flags PDFs with active content and executables", async () => {
    expect((await builtinScanner.scan(new TextEncoder().encode("%PDF-1.7 /OpenAction << /JavaScript (app.alert(1)) >>"))).clean).toBe(false);
    expect((await builtinScanner.scan(new Uint8Array([0x4d, 0x5a, 0x90, 0]))).clean).toBe(false);
    expect((await builtinScanner.scan(pdf)).clean).toBe(true);
  });

  it("documents reach an external AI provider only with the customer's consent", async () => {
    const real = new MockAIProvider();
    const external: AIProvider = { ...real, name: "external", simulated: false, analyseDocument: vi.fn(real.analyseDocument.bind(real)), draftBid: real.draftBid.bind(real), draftNegotiationMessage: real.draftNegotiationMessage.bind(real), draftBusinessCounter: real.draftBusinessCounter.bind(real) };
    const ctx = { ...(await makeCtx()), ai: external };
    const data = new TextEncoder().encode("TOTAL: $120.00 per month");
    const d1 = await uploadDocument(ctx, alex, { filename: "a.txt", mimeType: "text/plain", data, categoryId: "telco", kind: "bill" });
    expect(external.analyseDocument).not.toHaveBeenCalled();
    expect(d1.analysis?.summary).toMatch(/turn on AI document analysis/);
    await ctx.store.update("users", IDS.alex, { aiProcessingConsent: true });
    await uploadDocument(ctx, alex, { filename: "b.txt", mimeType: "text/plain", data, categoryId: "telco", kind: "bill" });
    expect(external.analyseDocument).toHaveBeenCalledTimes(1);
  });
});
