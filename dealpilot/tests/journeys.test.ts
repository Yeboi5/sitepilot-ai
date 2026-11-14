import { describe, expect, it } from "vitest";
import { ForbiddenError, ValidationError } from "@/lib/domain/permissions";
import { confirmExtraction, uploadDocument } from "@/lib/services/documents";
import { getGroup, joinGroup, simulateGroupGrowth, submitGroupOffer, takeUpGroupDeal } from "@/lib/services/groups";
import {
  createRequest, draftBidWithAI, getRequestForBusiness, getRequestForCustomer, listRequestsForBusiness, submitOffer,
} from "@/lib/services/marketplace";
import { addPricePoint, claimPriceAdjustment, createWatch, listAlerts, simulateFeedTick } from "@/lib/services/monitoring";
import {
  acceptCurrentOffer, approveDraft, approveFinalTerms, businessRespond, getBusinessNegotiation, prepareNextAction, walkAway,
} from "@/lib/services/negotiations";
import { cancelTransaction, listCustomerTransactions, listLedger, verifyTransaction } from "@/lib/services/transactions";
import { IDS } from "@/lib/store/seed";
import { alex, ben, erin, jordan, makeCtx, priya } from "./helpers";

const enc = new TextEncoder();

describe("Journey 1 — $5,500 fencing quote receives competing bids", () => {
  it("uploads, analyses, creates a request and compares simulated + real bids", async () => {
    const ctx = await makeCtx();
    const doc = await uploadDocument(ctx, alex, {
      filename: "quote.txt", mimeType: "text/plain", categoryId: "trades", kind: "quote",
      data: enc.encode("From: Fictional Fences\nColorbond panels: $3,150.00\nLabour: $2,350.00\nTOTAL: $5,500.00\nValid for 30 days"),
    });
    expect(doc.analysis?.totalCents).toBe(550_000);
    expect(doc.analysis?.simulated).toBe(true);
    expect(doc.analysis?.risks.some((r) => /warranty/i.test(r))).toBe(true);

    // The customer must review the extraction before it's used.
    const draftReq = { categoryId: "trades", title: "Front fence 12m", description: "Colorbond", region: "Sydney NSW", baselineCents: 550_000, recurrence: "one_off" as const, fields: { trade: "Fencing", size: "12" }, documentId: doc.id };
    await expect(createRequest(ctx, alex, draftReq)).rejects.toThrow(/Review and confirm/);
    const confirmed = await confirmExtraction(ctx, alex, doc.id, { vendor: "Fictional Fences Pty Ltd", totalCents: 550_000, recurrence: "one_off", lineItems: doc.analysis!.lineItems });
    expect(confirmed.confirmed?.vendor).toBe("Fictional Fences Pty Ltd");
    await expect(confirmExtraction(ctx, priya, doc.id, { recurrence: "one_off", lineItems: [] })).rejects.toBeInstanceOf(ForbiddenError);

    const req = await createRequest(ctx, alex, {
      categoryId: "trades", title: "Front fence 12m", description: "Colorbond", region: "Sydney NSW", baselineCents: 550_000,
      recurrence: "one_off", fields: { trade: "Fencing", size: "12" }, documentId: doc.id, simulateBids: true,
    });
    // Ben (real demo business in Sydney, trades) is notified and sees it.
    const benAlerts = await listAlerts(ctx, ben);
    expect(benAlerts.some((a) => a.href === `/biz/requests/${req.id}`)).toBe(true);
    const view = await getRequestForCustomer(ctx, alex, req.id);
    expect(view.comparison).toHaveLength(3);
    expect(view.comparison.every((r) => r.offer.isSimulated)).toBe(true);
    // Uninsured offer is flagged for a trade.
    expect(view.comparison.some((r) => r.flags.includes("Insurance not confirmed"))).toBe(true);
  });

  it("seeded fencing request shows three competing offers with credential flags", async () => {
    const ctx = await makeCtx();
    const view = await getRequestForCustomer(ctx, alex, IDS.reqFence);
    expect(view.comparison.map((r) => r.offer.priceCents).sort()).toEqual([440_000, 495_000, 510_000]);
    const budget = view.comparison.find((r) => r.offer.id === IDS.offBudget)!;
    expect(budget.flags).toEqual(expect.arrayContaining(["No licence number provided", "Insurance not confirmed"]));
    expect(budget.best.price).toBe(true);
    // Cheapest, but unlicensed and uninsured: ranked below compliant offers.
    expect(view.comparison.at(-1)!.offer.id).toBe(IDS.offBudget);
  });

  it("other customers cannot see the request", async () => {
    const ctx = await makeCtx();
    await expect(getRequestForCustomer(ctx, priya, IDS.reqFence)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("Journey 2 — negotiating a $120/month internet bill (simulated provider)", () => {
  it("requires approval, then reaches an agreed price and a pending transaction", async () => {
    const ctx = await makeCtx();
    let n = (await ctx.store.get("negotiations", IDS.negInternet))!;
    expect(n.state).toBe("awaiting_approval");
    const draft = n.messages.find((m) => m.pendingApproval)!;
    n = await approveDraft(ctx, alex, n.id, draft.id);
    // Simulated provider counters at $102 (between $84 ask and $120).
    expect(n.state).toBe("counter_received");
    expect(n.currentOfferCents).toBe(10_200);

    const step = await prepareNextAction(ctx, alex, n.id);
    expect(step.recommendation.action).toBe("counter");
    expect(step.negotiation.state).toBe("awaiting_approval");
    const draft2 = step.negotiation.messages.find((m) => m.pendingApproval)!;
    expect(draft2.amountCents).toBe(9_300);
    n = await approveDraft(ctx, alex, n.id, draft2.id);
    // The simulated provider accepted; the customer must still approve the final terms.
    expect(n.state).toBe("final_approval");
    expect((await listCustomerTransactions(ctx, alex)).transactions.some((t) => t.negotiationId === n.id)).toBe(false);
    n = await approveFinalTerms(ctx, alex, n.id, true);
    expect(n.state).toBe("agreed");
    expect(n.agreedCents).toBe(9_300);

    const { transactions } = await listCustomerTransactions(ctx, alex);
    const tx = transactions.find((t) => t.negotiationId === n.id)!;
    expect(tx.status).toBe("pending_verification");
    expect(tx.periodSavingsCents).toBe(2_700);
    expect(tx.annualSavingsCents).toBe(32_400);
    expect(tx.feeCents).toBe(0); // no fee until verified
    // Simulated counterparty: verified saving, but never a qualifying (fee-bearing) transaction.
    const v = await verifyTransaction(ctx, alex, tx.id, { method: "customer_confirmed_invoice", finalCents: 9_300, confirmed: true });
    expect(v).toMatchObject({ feeCents: 0, feeStatus: "not_qualifying", qualifiesForFee: false });
  });

  it("advisory mode never sends anything", async () => {
    const ctx = await makeCtx();
    await ctx.store.update("negotiations", IDS.negInternet, { mode: "advisory", state: "open", messages: [] });
    const { negotiation } = await prepareNextAction(ctx, alex, IDS.negInternet);
    expect(negotiation.state).toBe("open");
    expect(negotiation.messages.some((m) => m.kind === "sent")).toBe(false);
    expect(negotiation.messages.at(-1)!.kind).toBe("note");
  });

  it("limited autopilot acts within limits and is audit-logged; pauses outside them", async () => {
    const ctx = await makeCtx();
    await ctx.store.update("users", IDS.alex, { autopilotLimitCents: 20_000 });
    await ctx.store.update("negotiations", IDS.negInternet, { mode: "autopilot", state: "open", messages: [] });
    const { negotiation } = await prepareNextAction(ctx, alex, IDS.negInternet);
    expect(negotiation.state).toBe("counter_received");
    const audit = await ctx.store.list("audit", { action: "autopilot.acted" });
    expect(audit).toHaveLength(1);

    await ctx.store.update("users", IDS.alex, { autopilotLimitCents: 5_000 });
    const second = await prepareNextAction(ctx, alex, IDS.negInternet);
    expect(second.negotiation.state).toBe("awaiting_approval");
    expect(second.recommendation.reason).toMatch(/Autopilot paused/);
  });

  it("autopilot may propose acceptance but never approves final terms for the customer", async () => {
    const ctx = await makeCtx();
    await ctx.store.update("users", IDS.alex, { autopilotLimitCents: 20_000 });
    await ctx.store.update("negotiations", IDS.negInternet, { mode: "autopilot", state: "counter_received", currentOfferCents: 8_300, messages: [] });
    const { negotiation } = await prepareNextAction(ctx, alex, IDS.negInternet);
    expect(negotiation.state).toBe("final_approval");
    expect(negotiation.finalTerms?.customerApprovedAt).toBeUndefined();
    expect((await listCustomerTransactions(ctx, alex)).transactions.some((t) => t.negotiationId === IDS.negInternet)).toBe(false);
  });

  it("walking away records no saving and no fee", async () => {
    const ctx = await makeCtx();
    const n = await walkAway(ctx, alex, IDS.negInternet);
    expect(n.state).toBe("cancelled");
    const { transactions } = await listCustomerTransactions(ctx, alex);
    expect(transactions.some((t) => t.negotiationId === IDS.negInternet)).toBe(false);
  });
});

describe("Journey 3 — monitoring a retail purchase for a price drop", () => {
  it("simulated feed drop raises adjustment alert and a claim can be verified", async () => {
    const ctx = await makeCtx();
    await simulateFeedTick(ctx, alex, IDS.watchHeadphones);
    const alerts = await listAlerts(ctx, alex);
    const adj = alerts.find((a) => a.kind === "adjustment_eligible")!;
    expect(adj.potentialSavingsCents).toBe(5_000);
    expect(alerts.some((a) => a.kind === "target_reached")).toBe(true);
    // Running again doesn't duplicate alerts.
    const before = alerts.length;
    const { runChecks } = await import("@/lib/services/monitoring");
    expect(await runChecks(ctx, alex)).toBe(0);
    expect((await listAlerts(ctx, alex)).length).toBe(before);

    await claimPriceAdjustment(ctx, alex, IDS.watchHeadphones);
    const tx = (await listCustomerTransactions(ctx, alex)).transactions.find((t) => t.description.startsWith("Price adjustment"))!;
    const verified = await verifyTransaction(ctx, alex, tx.id, { method: "customer_confirmed_invoice", finalCents: 39_900, confirmed: true });
    expect(verified.periodSavingsCents).toBe(5_000);
    // Simulated price feed: not a qualifying transaction.
    expect(verified.feeCents).toBe(0);
  });

  it("a real (manually entered) price drop the customer claims is a qualifying saving", async () => {
    const ctx = await makeCtx();
    const w = await createWatch(ctx, alex, { kind: "retail_product", label: "Kettle", merchant: "Real Shop", categoryId: "retail", priceCents: 12_900, adjustmentWindowDays: 14 });
    await addPricePoint(ctx, alex, w.id, 11_900);
    const n = await claimPriceAdjustment(ctx, alex, w.id);
    expect(n.state).toBe("agreed"); // no business party: the customer's claim is the approval
    const tx = (await listCustomerTransactions(ctx, alex)).transactions.find((t) => t.negotiationId === n.id)!;
    const v = await verifyTransaction(ctx, alex, tx.id, { method: "customer_confirmed_invoice", finalCents: 11_900, confirmed: true });
    expect(v).toMatchObject({ periodSavingsCents: 1_000, feeCents: 150, feeStatus: "assessed", qualifiesForFee: true });
  });
});

describe("Journey 4 — several customers combine demand for a group offer", () => {
  it("joining unlocks a tier, growth unlocks the next, members can take it up", async () => {
    const ctx = await makeCtx();
    let g = await getGroup(ctx, alex, IDS.grpSolar);
    expect(g.status.members).toBe(4);
    expect(g.status.currentPriceCents).toBeUndefined();
    await joinGroup(ctx, alex, IDS.grpSolar);
    g = await getGroup(ctx, alex, IDS.grpSolar);
    expect(g.status.currentPriceCents).toBe(660_000);
    expect(g.status.currentSavingsPerMemberCents).toBe(90_000);
    // Members are notified when a tier unlocks.
    expect((await listAlerts(ctx, priya)).some((a) => /Group price unlocked/.test(a.title))).toBe(true);
    await simulateGroupGrowth(ctx, alex, IDS.grpSolar, 5);
    g = await getGroup(ctx, alex, IDS.grpSolar);
    expect(g.status.currentPriceCents).toBe(610_000);
    const tx = await takeUpGroupDeal(ctx, alex, IDS.grpSolar, true);
    expect(tx.periodSavingsCents).toBe(140_000);
    await expect(takeUpGroupDeal(ctx, alex, IDS.grpSolar, true)).rejects.toBeInstanceOf(ValidationError);
  });

  it("enforces region eligibility and hides other members' identities", async () => {
    const ctx = await makeCtx();
    await expect(joinGroup(ctx, jordan, IDS.grpSolar)).rejects.toThrow(/limited to Sydney NSW/);
    const g = await getGroup(ctx, alex, IDS.grpSolar);
    expect(g.group.memberIds).toEqual([]);
  });

  it("businesses submit volume offers with strictly decreasing tiers", async () => {
    const ctx = await makeCtx();
    await expect(submitGroupOffer(ctx, ben, IDS.grpFence, { tiers: [{ minMembers: 4, priceCents: 260_000 }, { minMembers: 6, priceCents: 270_000 }], terms: "", validDays: 14 })).rejects.toThrow(/strictly lower/);
    const offer = await submitGroupOffer(ctx, ben, IDS.grpFence, { tiers: [{ minMembers: 4, priceCents: 265_000 }, { minMembers: 6, priceCents: 245_000 }], terms: "Colorbond, shared posts", validDays: 14 });
    expect(offer.approvedByUserId).toBe(IDS.ben);
    await expect(submitGroupOffer(ctx, erin, IDS.grpFence, { tiers: [{ minMembers: 4, priceCents: 200_000 }], terms: "", validDays: 14 })).rejects.toThrow(/service categories/);
  });
});

describe("Journey 5 — a business receives a request and submits a counteroffer", () => {
  it("Ben sees the request (without customer identity) and the redacted negotiation", async () => {
    const ctx = await makeCtx();
    const list = await listRequestsForBusiness(ctx, ben);
    expect(list.some((r) => r.request.id === IDS.reqFence)).toBe(true);
    const view = await getRequestForBusiness(ctx, ben, IDS.reqFence);
    expect("customerId" in view.request).toBe(false);
    expect(view.competing).toBe(2);
    const n = await getBusinessNegotiation(ctx, ben, IDS.negFence);
    expect(n.targetCents).toBe(0); // customer's target is never revealed
    expect(n.messages.some((m) => m.kind === "analysis")).toBe(false);
  });

  it("Ben counters; invalid counters are rejected", async () => {
    const ctx = await makeCtx();
    await expect(businessRespond(ctx, ben, IDS.negFence, { action: "counter", priceCents: 520_000, message: "" })).rejects.toThrow(/lower than your current offer/);
    await expect(businessRespond(ctx, ben, IDS.negFence, { action: "counter", priceCents: 450_000, message: "" })).rejects.toThrow(/accept it instead/);
    const n = await businessRespond(ctx, ben, IDS.negFence, { action: "counter", priceCents: 480_000, message: "Best I can do" });
    expect(n.state).toBe("counter_received");
    expect((await ctx.store.get("offers", IDS.offBen))!.priceCents).toBe(480_000);
    expect((await listAlerts(ctx, alex)).some((a) => a.title.includes("Counteroffer"))).toBe(true);
  });

  it("AI-drafted bids stay invisible until a real business user submits them", async () => {
    const ctx = await makeCtx();
    const req = await createRequest(ctx, alex, { categoryId: "trades", title: "Pool fence 20m", description: "Glass", region: "Sydney NSW", baselineCents: 900_000, recurrence: "one_off", fields: { trade: "Fencing" } });
    const draft = await draftBidWithAI(ctx, ben, req.id);
    expect(draft.priceCents).toBeLessThan(900_000);
    expect((await getRequestForCustomer(ctx, alex, req.id)).comparison).toHaveLength(0);
    const offer = await submitOffer(ctx, ben, req.id, { ...draft, includesInsurance: true, validDays: 14, aiDrafted: true });
    expect(offer.approvedByUserId).toBe(IDS.ben);
    expect((await getRequestForCustomer(ctx, alex, req.id)).comparison).toHaveLength(1);
  });

  it("a business outside the category can't see the request", async () => {
    const ctx = await makeCtx();
    await expect(getRequestForBusiness(ctx, erin, IDS.reqFence)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("Journey 6 — customer approves a negotiated deal and records verified savings", () => {
  it("counter → customer counter → business accepts → verify → fee charged once", async () => {
    const ctx = await makeCtx();
    await businessRespond(ctx, ben, IDS.negFence, { action: "counter", priceCents: 480_000, message: "" });
    const step = await prepareNextAction(ctx, alex, IDS.negFence);
    expect(step.recommendation).toMatchObject({ action: "counter", priceCents: 470_000 });
    const draft = step.negotiation.messages.find((m) => m.pendingApproval)!;
    await approveDraft(ctx, alex, IDS.negFence, draft.id);
    const accepted = await businessRespond(ctx, ben, IDS.negFence, { action: "accept", message: "Deal" });
    // Business approved by accepting; the customer must approve the final terms too.
    expect(accepted.state).toBe("final_approval");
    await expect(approveFinalTerms(ctx, ben, IDS.negFence, true)).rejects.toThrow(/isn't needed/);
    const agreed = await approveFinalTerms(ctx, alex, IDS.negFence, true);
    expect(agreed.state).toBe("agreed");

    const tx = (await listCustomerTransactions(ctx, alex)).transactions.find((t) => t.negotiationId === IDS.negFence)!;
    expect(tx.status).toBe("pending_verification");
    expect(tx.periodSavingsCents).toBe(80_000);
    // Other offers were declined; Ben's accepted.
    expect((await ctx.store.get("offers", IDS.offHarbour))!.status).toBe("declined");
    expect((await ctx.store.get("offers", IDS.offBen))!.status).toBe("accepted");

    // Verified against the final invoice, which came in $50 higher than agreed.
    const v = await verifyTransaction(ctx, alex, tx.id, { method: "customer_confirmed_invoice", finalCents: 475_000, confirmed: true });
    expect(v.periodSavingsCents).toBe(75_000);
    expect(v.feeCents).toBe(150);
    expect((await ctx.store.get("negotiations", IDS.negFence))!.state).toBe("completed");
    expect((await ctx.store.get("requests", IDS.reqFence))!.status).toBe("completed");

    await expect(verifyTransaction(ctx, alex, tx.id, { method: "customer_confirmed_invoice", finalCents: 475_000, confirmed: true })).rejects.toBeInstanceOf(ValidationError);
    const fees = (await listLedger(ctx, alex)).filter((e) => e.transactionId === tx.id && e.type === "fee_assessed");
    expect(fees).toHaveLength(1);
    expect(fees[0].amountCents).toBe(150);
    expect(fees[0].note).toMatch(/nothing was charged/);
  });

  it("verifying with no saving waives the fee; cancelling charges nothing", async () => {
    const ctx = await makeCtx();
    await businessRespond(ctx, ben, IDS.negFence, { action: "counter", priceCents: 480_000, message: "" });
    const proposed = await acceptCurrentOffer(ctx, alex, IDS.negFence, true);
    expect(proposed.state).toBe("final_approval"); // waits for the business
    await approveFinalTerms(ctx, ben, IDS.negFence, true);
    const tx = (await listCustomerTransactions(ctx, alex)).transactions.find((t) => t.negotiationId === IDS.negFence)!;
    const v = await verifyTransaction(ctx, alex, tx.id, { method: "customer_confirmed_invoice", finalCents: 560_000, confirmed: true });
    expect(v.periodSavingsCents).toBe(0);
    expect(v.feeCents).toBe(0);
    expect(v.feeStatus).toBe("waived");

    const ctx2 = await makeCtx();
    await businessRespond(ctx2, ben, IDS.negFence, { action: "counter", priceCents: 480_000, message: "" });
    await acceptCurrentOffer(ctx2, alex, IDS.negFence, true);
    await approveFinalTerms(ctx2, ben, IDS.negFence, true);
    const tx2 = (await listCustomerTransactions(ctx2, alex)).transactions.find((t) => t.negotiationId === IDS.negFence)!;
    const c = await cancelTransaction(ctx2, alex, tx2.id, "Job didn't go ahead");
    expect(c.feeCents).toBe(0);
    expect((await listLedger(ctx2, alex)).some((e) => e.transactionId === tx2.id && e.type === "fee_charged")).toBe(false);
  });

  it("customers can't verify someone else's transaction", async () => {
    const ctx = await makeCtx();
    await expect(verifyTransaction(ctx, priya, IDS.txCar, { method: "customer_confirmed_invoice", finalCents: 1, confirmed: true })).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("Phase 2 — integrity under concurrency and verification gating", () => {
  async function agreedFenceDeal() {
    const ctx = await makeCtx();
    await businessRespond(ctx, ben, IDS.negFence, { action: "counter", priceCents: 480_000, message: "" });
    await acceptCurrentOffer(ctx, alex, IDS.negFence, true);
    await approveFinalTerms(ctx, ben, IDS.negFence, true);
    const tx = (await listCustomerTransactions(ctx, alex)).transactions.find((t) => t.negotiationId === IDS.negFence)!;
    return { ctx, tx };
  }

  it("two simultaneous verifications: exactly one succeeds and one fee is assessed", async () => {
    const { ctx, tx } = await agreedFenceDeal();
    const input = { method: "customer_confirmed_invoice" as const, finalCents: 480_000, confirmed: true };
    const results = await Promise.allSettled([verifyTransaction(ctx, alex, tx.id, input), verifyTransaction(ctx, alex, tx.id, input)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await listLedger(ctx, alex)).filter((e) => e.transactionId === tx.id && e.type === "fee_assessed")).toHaveLength(1);
  });

  it("verify and cancel racing: one wins, never both", async () => {
    const { ctx, tx } = await agreedFenceDeal();
    const results = await Promise.allSettled([
      verifyTransaction(ctx, alex, tx.id, { method: "customer_confirmed_invoice", finalCents: 480_000, confirmed: true }),
      cancelTransaction(ctx, alex, tx.id, "changed mind"),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const final = (await ctx.store.get("transactions", tx.id))!;
    expect(["verified", "cancelled"]).toContain(final.status);
    if (final.status === "cancelled") expect(final.feeCents).toBe(0);
  });

  it("stale writes are rejected instead of overwriting (optimistic concurrency)", async () => {
    const ctx = await makeCtx();
    const stale = (await ctx.store.get("negotiations", IDS.negFence))!;
    await businessRespond(ctx, ben, IDS.negFence, { action: "counter", priceCents: 480_000, message: "" });
    const { applyNegotiation } = await import("@/lib/services/negotiation-store");
    await expect(applyNegotiation(ctx, stale, null, { targetCents: 1 })).rejects.toThrow(/updated by someone else/);
  });

  it("a failed batch writes nothing", async () => {
    const ctx = await makeCtx();
    const before = (await ctx.store.list("ledger")).length;
    await expect(ctx.store.atomic([], [
      { op: "insert", table: "ledger", row: { id: "x1", transactionId: IDS.txCar, userId: IDS.alex, type: "fee_assessed", amountCents: 1, currency: "AUD", idempotencyKey: "k-new", simulated: true, createdAt: "" } },
      { op: "insert", table: "ledger", row: { id: "x2", transactionId: IDS.txCar, userId: IDS.alex, type: "fee_assessed", amountCents: 1, currency: "AUD", idempotencyKey: `fee:${IDS.txCar}`, simulated: true, createdAt: "" } },
    ])).rejects.toThrow(/idempotency/);
    expect((await ctx.store.list("ledger")).length).toBe(before);
  });

  it("unverified or suspended businesses cannot submit offers or agree deals", async () => {
    const ctx = await makeCtx();
    const req = await createRequest(ctx, alex, { categoryId: "trades", title: "Gate repair", description: "", region: "Sydney NSW", baselineCents: 90_000, recurrence: "one_off", fields: { trade: "Fencing" } });
    const offer = { priceCents: 80_000, scope: "Repair", materials: "", warrantyMonths: 12, completionDays: 3, includesInsurance: true, validDays: 7, aiDrafted: false };
    await ctx.store.update("businesses", IDS.bBen, { verificationStatus: "pending" });
    await expect(submitOffer(ctx, ben, req.id, offer)).rejects.toThrow(/not been verified/);
    await ctx.store.update("businesses", IDS.bBen, { verificationStatus: "suspended", statusReason: "Insurance lapsed" });
    await expect(submitOffer(ctx, ben, req.id, offer)).rejects.toThrow(/suspended/);
    await expect(businessRespond(ctx, ben, IDS.negFence, { action: "counter", priceCents: 480_000, message: "" })).rejects.toThrow(/suspended/);
    // Suspended business offers disappear from comparisons.
    const view = await getRequestForCustomer(ctx, alex, IDS.reqFence);
    expect(view.comparison.some((r) => r.offer.id === IDS.offBen)).toBe(false);
  });

  it("an expired licence blocks new offers in licensed categories", async () => {
    const ctx = await makeCtx();
    await ctx.store.update("credentials", "00000000-0000-4000-8000-000000001101", { expiresAt: "2026-01-01T00:00:00.000Z" });
    const req = await createRequest(ctx, alex, { categoryId: "trades", title: "Gate repair", description: "", region: "Sydney NSW", baselineCents: 90_000, recurrence: "one_off", fields: { trade: "Fencing" } });
    await expect(submitOffer(ctx, ben, req.id, { priceCents: 80_000, scope: "Repair", materials: "", warrantyMonths: 12, completionDays: 3, includesInsurance: true, validDays: 7, aiDrafted: false })).rejects.toThrow(/current licence/);
  });
});
