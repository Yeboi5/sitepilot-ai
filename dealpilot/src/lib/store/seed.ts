import { MockAIProvider } from "../ai/mock";
import { hashPassword } from "../auth/password";
import { getCategory } from "../domain/categories";
import { evaluateWatch } from "../domain/monitoring";
import { calculateSavings } from "../domain/savings";
import type {
  Alert, Business, ExpenseLine, LedgerEntry, Negotiation, Offer, PriceWatch, PurchaseRequest,
  PurchasingGroup, StoredDocument, Transaction, User,
} from "../domain/types";
import type { Store } from "./types";

/**
 * DEMONSTRATION DATA ONLY. Every person, business, offer, price and saving
 * below is fictional. Rows are flagged (isDemo / isSimulated) and the UI shows
 * a demo banner. IDs are fixed UUIDs so the SQL seed can mirror them.
 */
export const DEMO_PASSWORD = "DealPilotDemo!2026";
const DEMO_SALT = "dealpilot-demo-salt-not-secret";

export const sid = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;

export const IDS = {
  alex: sid(1), priya: sid(2), sam: sid(3), jordan: sid(4), ben: sid(5), erin: sid(6), admin: sid(7),
  bBen: sid(101), bHarbour: sid(102), bBudget: sid(103), bErin: sid(104), bStreamline: sid(105), bSunpeak: sid(106), bAutocare: sid(107),
  docFence: sid(201), docInternet: sid(202),
  reqFence: sid(301),
  offHarbour: sid(401), offBudget: sid(402), offBen: sid(403),
  negFence: sid(501), negInternet: sid(502),
  grpSolar: sid(601), grpFence: sid(602), grpEnergy: sid(603),
  watchHeadphones: sid(701), watchPower: sid(702), watchStream: sid(703), watchInsurance: sid(704),
  txCar: sid(801),
};

export const DEMO_ACCOUNTS = [
  { email: "alex@demo.dealpilot.test", role: "customer", label: "Alex — customer (journeys 1, 2, 3, 4, 6)" },
  { email: "priya@demo.dealpilot.test", role: "customer", label: "Priya — customer, purchasing-group member" },
  { email: "ben@demo.dealpilot.test", role: "business", label: "Ben — Ben's Fencing & Gates (journey 5)" },
  { email: "erin@demo.dealpilot.test", role: "business", label: "Erin — Bright Energy Co-op (bulk offers)" },
  { email: "admin@demo.dealpilot.test", role: "admin", label: "Admin — audit log & ledger" },
] as const;

const FENCE_QUOTE = `QUOTE #Q-2041 (DEMO DOCUMENT — FICTIONAL)
From: Premier Perimeter Fencing (fictional)
Customer: Alex Demo
Supply and install 30m Colorbond fence 1.8m high
Remove and dispose existing timber fence: $650.00
Colorbond panels, posts and rails (30m): $3,150.00
Labour and installation: $1,450.00
Concrete footings: $250.00
TOTAL: $5,500.00
Deposit of 30% required before start.
Price subject to change if site conditions differ.
Valid for 30 days.`;

const INTERNET_BILL = `TAX INVOICE (DEMO DOCUMENT — FICTIONAL)
Provider: StreamLine Broadband (simulated)
Plan: NBN 100 Unlimited — monthly, no lock-in
Customer for 4 years
Plan fee: $110.00
Modem rental: $10.00
Amount due: $120.00 per month`;

export async function seedDemoData(store: Store, now = new Date()): Promise<void> {
  const ai = new MockAIProvider();
  const iso = (daysFromNow: number) => new Date(now.getTime() + daysFromNow * 86_400_000).toISOString();
  const day = (daysFromNow: number) => iso(daysFromNow).slice(0, 10);
  const passwordHash = hashPassword(DEMO_PASSWORD, DEMO_SALT);

  // ─── Users ────────────────────────────────────────────────────────────────
  const user = (id: string, email: string, name: string, role: User["role"], region: string, extra: Partial<User> = {}): User => ({
    id, email, name, role, region, passwordHash, permissionMode: "approval", autopilotLimitCents: 0, isDemo: true, createdAt: iso(-60), ...extra,
  });
  const users: User[] = [
    user(IDS.alex, "alex@demo.dealpilot.test", "Alex Demo", "customer", "Sydney NSW"),
    user(IDS.priya, "priya@demo.dealpilot.test", "Priya Demo", "customer", "Sydney NSW"),
    user(IDS.sam, "sam@demo.dealpilot.test", "Sam Demo", "customer", "Sydney NSW"),
    user(IDS.jordan, "jordan@demo.dealpilot.test", "Jordan Demo", "customer", "Melbourne VIC"),
    user(IDS.ben, "ben@demo.dealpilot.test", "Ben Demo", "business", "Sydney NSW", { businessId: IDS.bBen }),
    user(IDS.erin, "erin@demo.dealpilot.test", "Erin Demo", "business", "Australia-wide", { businessId: IDS.bErin }),
    user(IDS.admin, "admin@demo.dealpilot.test", "Admin Demo", "admin", "Australia-wide"),
  ];
  for (const u of users) await store.insert("users", u);

  // ─── Businesses ───────────────────────────────────────────────────────────
  const biz = (b: Partial<Business> & Pick<Business, "id" | "name" | "categories" | "regions">): Business => ({
    description: "", qualifications: [], insured: true, reviewCount: 0, reviewsVerified: false, isSimulated: true, createdAt: iso(-90), ...b,
  });
  const businesses: Business[] = [
    biz({ id: IDS.bBen, ownerId: IDS.ben, name: "Ben's Fencing & Gates (demo)", categories: ["trades"], regions: ["Sydney NSW"], description: "Colorbond, timber and pool fencing across Sydney. Demo business account.", qualifications: ["Licensed fencing contractor (demo)", "Public liability $10m (demo)"], licenceNumber: "DEMO-LIC-48213", rating: 4.8, reviewCount: 3, reviewsVerified: true, isSimulated: false }),
    biz({ id: IDS.bHarbour, name: "Harbour Fence Co (simulated)", categories: ["trades"], regions: ["Sydney NSW"], qualifications: ["Licensed (simulated)"], licenceNumber: "SIM-LIC-11822", rating: 4.5, reviewCount: 41 }),
    biz({ id: IDS.bBudget, name: "Budget Boundaries (simulated)", categories: ["trades"], regions: ["Sydney NSW"], insured: false, rating: 3.9, reviewCount: 12 }),
    biz({ id: IDS.bErin, ownerId: IDS.erin, name: "Bright Energy Co-op (demo)", categories: ["energy"], regions: ["Australia-wide"], description: "Community energy retailer. Demo business account.", qualifications: ["Authorised retailer (demo)"], licenceNumber: "DEMO-RET-0091", isSimulated: false }),
    biz({ id: IDS.bStreamline, name: "StreamLine Broadband (simulated)", categories: ["telco"], regions: ["Australia-wide"] }),
    biz({ id: IDS.bSunpeak, name: "SunPeak Solar (simulated)", categories: ["energy", "trades"], regions: ["Sydney NSW"], licenceNumber: "SIM-CEC-5521", qualifications: ["Accredited installer (simulated)"] }),
    biz({ id: IDS.bAutocare, name: "Inner West Autocare (simulated)", categories: ["vehicle"], regions: ["Sydney NSW"], licenceNumber: "SIM-MVR-7712" }),
  ];
  for (const b of businesses) await store.insert("businesses", b);

  // ─── Documents ────────────────────────────────────────────────────────────
  const enc = new TextEncoder();
  const docs: [string, string, string, string, StoredDocument["kind"]][] = [
    [IDS.docFence, "fencing-quote-demo.txt", FENCE_QUOTE, "trades", "quote"],
    [IDS.docInternet, "internet-bill-demo.txt", INTERNET_BILL, "telco", "bill"],
  ];
  for (const [id, filename, text, categoryId, kind] of docs) {
    const data = enc.encode(text);
    const storageKey = `${IDS.alex}/${id}`;
    await store.putBlob(storageKey, data, "text/plain");
    const analysis = await ai.analyseDocument({ filename, mimeType: "text/plain", data, category: getCategory(categoryId) });
    await store.insert("documents", { id, ownerId: IDS.alex, filename, mimeType: "text/plain", sizeBytes: data.length, categoryId, kind, storageKey, analysis, isDemo: true, uploadedAt: iso(-3) });
  }

  // ─── Journey 1/5/6: fencing request, competing bids, negotiation ─────────
  const fence: PurchaseRequest = {
    id: IDS.reqFence, customerId: IDS.alex, categoryId: "trades", title: "Replace 30m Colorbond side and rear fence",
    description: "Remove old timber paling fence and install 1.8m Colorbond, 30 metres, flat block.",
    region: "Sydney NSW", fields: { trade: "Fencing", size: 30, material: "Colorbond 1.8m", removal: true, access: "Side gate access" },
    baselineCents: 550_000, recurrence: "one_off", documentId: IDS.docFence, status: "negotiating", closesAt: iso(10), isDemo: true, createdAt: iso(-3),
  };
  await store.insert("requests", fence);
  const offer = (o: Partial<Offer> & Pick<Offer, "id" | "businessId" | "priceCents">): Offer => ({
    requestId: IDS.reqFence, status: "submitted", recurrence: "one_off", scope: "Remove existing fence, supply and install 30m Colorbond 1.8m.", materials: "Colorbond steel panels, galvanised posts", warrantyMonths: 24, completionDays: 7, includesInsurance: true, aiDrafted: false, validUntil: iso(14), isSimulated: true, createdAt: iso(-2), updatedAt: iso(-2), ...o,
  });
  await store.insert("offers", offer({ id: IDS.offHarbour, businessId: IDS.bHarbour, priceCents: 495_000, warrantyMonths: 60, completionDays: 7 }));
  await store.insert("offers", offer({ id: IDS.offBudget, businessId: IDS.bBudget, priceCents: 440_000, warrantyMonths: 12, completionDays: 5, includesInsurance: false, materials: "Generic steel panels (not Colorbond)" }));
  await store.insert("offers", offer({ id: IDS.offBen, businessId: IDS.bBen, priceCents: 510_000, warrantyMonths: 84, completionDays: 10, aiDrafted: true, approvedByUserId: IDS.ben, approvedAt: iso(-2), isSimulated: false, status: "countered", materials: "Genuine Colorbond, 65mm galvanised posts, concrete footings" }));

  const fenceNeg: Negotiation = {
    id: IDS.negFence, customerId: IDS.alex, categoryId: "trades", title: "Fence replacement with Ben's Fencing & Gates", requestId: IDS.reqFence, offerId: IDS.offBen, businessId: IDS.bBen,
    counterpartyName: "Ben's Fencing & Gates (demo)", mode: "approval", state: "awaiting_counterparty", baselineCents: 550_000, targetCents: 460_000, currentOfferCents: 510_000,
    recurrence: "one_off", simulated: false, createdAt: iso(-2), updatedAt: iso(-1),
    messages: [
      { id: sid(5011), at: iso(-2), from: "ai", kind: "analysis", body: "Ben's offer is $400 under your original $5,500 quote and has the longest warranty (7 years). Competing offers go as low as $4,400, but that one has no insurance and non-Colorbond panels. Suggested target: $4,600." },
      { id: sid(5012), at: iso(-1), from: "ai", kind: "sent", body: "Hi Ben, thanks for the quote. I have other licensed and insured offers in the high $4,000s. If you can do $4,600 with the same scope and 7-year warranty, I'm ready to book. — Alex", amountCents: 460_000, approvedAt: iso(-1) },
    ],
  };
  await store.insert("negotiations", fenceNeg);

  // ─── Journey 2: internet bill negotiation (simulated provider) ───────────
  const inetNeg: Negotiation = {
    id: IDS.negInternet, customerId: IDS.alex, categoryId: "telco", title: "Home internet — StreamLine Broadband", businessId: IDS.bStreamline,
    counterpartyName: "StreamLine Broadband (simulated)", mode: "approval", state: "awaiting_approval", baselineCents: 12_000, targetCents: 8_400, currentOfferCents: 12_000,
    recurrence: "monthly", simulated: true, createdAt: iso(-1), updatedAt: iso(-1),
    messages: [
      { id: sid(5021), at: iso(-1), from: "ai", kind: "analysis", body: "Your bill is $120/month ($110 plan + $10 modem rental). After 4 years with no lock-in you're a good candidate for a retention offer. Simulated market range for similar plans is $84–$102. Suggested target: $84/month." },
      { id: sid(5022), at: iso(-1), from: "ai", kind: "draft", pendingApproval: true, amountCents: 8_400, simulated: true, body: "Hi StreamLine Broadband, I've been a customer for 4 years and I'm paying $120/month including modem rental. Comparable NBN 100 plans are available for less. I'd like to stay with you at $84/month. Can you offer that? — Alex" },
    ],
  };
  await store.insert("negotiations", inetNeg);

  // ─── Journey 4: purchasing groups ─────────────────────────────────────────
  const groups: PurchasingGroup[] = [
    {
      id: IDS.grpSolar, categoryId: "energy", title: "Rooftop solar 6.6kW — Sydney bulk buy", description: "Neighbours combining demand for 6.6kW systems with a 10-year workmanship warranty.",
      region: "Sydney NSW", eligibility: "Sydney NSW homeowners with a suitable roof", memberIds: [IDS.priya, IDS.sam], simulatedMemberCount: 2, targetSize: 10,
      baselineCents: 750_000, recurrence: "one_off", expiresAt: iso(14), status: "offer_available", isSimulated: true, createdAt: iso(-10),
      offers: [{ id: sid(6011), businessId: IDS.bSunpeak, tiers: [{ minMembers: 5, priceCents: 660_000 }, { minMembers: 10, priceCents: 610_000 }], terms: "Tier 1 Jinko-equivalent panels, 10-year workmanship warranty. Simulated offer.", validUntil: iso(14), isSimulated: true, createdAt: iso(-5) }],
    },
    {
      id: IDS.grpFence, categoryId: "trades", title: "Shared boundary fencing — Elm Street neighbours", description: "Four neighbouring households replacing shared boundary fences at the same time.",
      region: "Sydney NSW", eligibility: "Households on Elm Street (demo) in Sydney NSW", memberIds: [IDS.priya], simulatedMemberCount: 3, targetSize: 6,
      baselineCents: 300_000, recurrence: "one_off", expiresAt: iso(21), status: "forming", isSimulated: true, createdAt: iso(-4), offers: [],
    },
    {
      id: IDS.grpEnergy, categoryId: "energy", title: "Electricity plan group switch — Victoria", description: "Households negotiating a better electricity rate together.",
      region: "Melbourne VIC", eligibility: "Melbourne VIC households, any retailer", memberIds: [IDS.jordan], simulatedMemberCount: 30, targetSize: 50,
      baselineCents: 22_000, recurrence: "monthly", expiresAt: iso(30), status: "offer_available", isSimulated: true, createdAt: iso(-15),
      offers: [{ id: sid(6031), businessId: IDS.bErin, tiers: [{ minMembers: 20, priceCents: 18_500 }, { minMembers: 50, priceCents: 17_000 }], terms: "12-month rate guarantee, no exit fees. Demo offer.", validUntil: iso(30), approvedByUserId: IDS.erin, isSimulated: false, createdAt: iso(-7) }],
    },
  ];
  for (const g of groups) await store.insert("groups", g);

  // ─── Journey 3: price monitoring ─────────────────────────────────────────
  const watches: PriceWatch[] = [
    { id: IDS.watchHeadphones, userId: IDS.alex, kind: "retail_product", label: "Noise-cancelling headphones (demo model)", merchant: "Demo Electronics (simulated retailer)", categoryId: "retail", purchasePriceCents: 44_900, purchasedAt: iso(-9), targetPriceCents: 39_900, adjustmentWindowDays: 30, history: [{ at: iso(-9), cents: 44_900, source: "manual" }], dataSource: "simulated_feed", active: true, createdAt: iso(-9) },
    { id: IDS.watchPower, userId: IDS.alex, kind: "bill", label: "Electricity bill (demo retailer)", merchant: "Demo Energy Retailer (simulated)", categoryId: "energy", purchasePriceCents: 21_000, history: [{ at: iso(-35), cents: 21_000, source: "manual" }, { at: iso(-5), cents: 23_600, source: "manual" }], dataSource: "manual", active: true, createdAt: iso(-60) },
    { id: IDS.watchStream, userId: IDS.alex, kind: "subscription", label: "StreamFlix Premium (demo)", merchant: "StreamFlix (fictional)", categoryId: "subscriptions", purchasePriceCents: 2_499, renewalDate: iso(12), history: [{ at: iso(-20), cents: 2_499, source: "manual" }], dataSource: "manual", active: true, createdAt: iso(-90) },
    { id: IDS.watchInsurance, userId: IDS.alex, kind: "contract", label: "Car insurance policy (demo)", merchant: "Demo Insurer (fictional)", categoryId: "insurance", purchasePriceCents: 142_000, renewalDate: iso(25), history: [{ at: iso(-340), cents: 142_000, source: "manual" }], dataSource: "manual", active: true, createdAt: iso(-340) },
  ];
  let alertN = 9000;
  for (const w of watches) {
    await store.insert("watches", w);
    for (const s of evaluateWatch(w, now)) {
      const a: Alert = { ...s, id: sid(alertN++), userId: w.userId, read: false, createdAt: iso(-1) };
      await store.insert("alerts", a);
    }
  }

  // ─── Money Guardian expense lines (manual upload) ────────────────────────
  const exp: [string, string, number][] = [
    [day(-75), "StreamFlix", 2_299], [day(-45), "StreamFlix", 2_299], [day(-15), "StreamFlix", 2_499],
    [day(-70), "FitLife Gym", 6_495], [day(-40), "FitLife Gym", 6_495], [day(-10), "FitLife Gym", 6_495],
    [day(-62), "CloudBox Storage", 449], [day(-32), "CloudBox Storage", 449], [day(-2), "CloudBox Storage", 449],
    [day(-6), "Demo Grocer", 8_740], [day(-6), "Demo Grocer", 8_740], [day(-20), "Demo Grocer", 6_215],
  ];
  let expN = 9500;
  for (const [date, merchant, amountCents] of exp) {
    const line: ExpenseLine = { id: sid(expN++), userId: IDS.alex, date, merchant, amountCents, source: "manual", createdAt: iso(-1) };
    await store.insert("expenses", line);
  }

  // ─── Savings history: one completed, verified demo transaction ───────────
  const s = calculateSavings(48_000, 39_500, "one_off");
  const tx: Transaction = {
    id: IDS.txCar, customerId: IDS.alex, businessId: IDS.bAutocare, categoryId: "vehicle", description: "Logbook service — Inner West Autocare (simulated)",
    baselineCents: 48_000, finalCents: 39_500, recurrence: "one_off", periodSavingsCents: s.periodSavingsCents, annualSavingsCents: s.annualSavingsCents,
    status: "verified", verificationMethod: "customer_confirmed_invoice", verifiedAt: iso(-20), verifiedBy: IDS.alex, feeCents: 150, feeStatus: "charged_simulated", simulated: true, createdAt: iso(-25),
  };
  await store.insert("transactions", tx);
  const ledger: LedgerEntry[] = [
    { id: sid(8011), transactionId: tx.id, userId: IDS.alex, type: "saving_recorded", amountCents: s.periodSavingsCents, currency: "AUD", idempotencyKey: `saving:${tx.id}`, simulated: true, createdAt: iso(-25) },
    { id: sid(8012), transactionId: tx.id, userId: IDS.alex, type: "saving_verified", amountCents: s.periodSavingsCents, currency: "AUD", idempotencyKey: `verified:${tx.id}`, simulated: true, createdAt: iso(-20) },
    { id: sid(8013), transactionId: tx.id, userId: IDS.alex, type: "fee_charged", amountCents: 150, currency: "AUD", idempotencyKey: `fee:${tx.id}`, simulated: true, note: "Simulated payment — no real charge", createdAt: iso(-20) },
  ];
  for (const e of ledger) await store.insert("ledger", e);
}
