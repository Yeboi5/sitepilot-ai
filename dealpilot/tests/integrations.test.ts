import { describe, expect, it } from "vitest";
import { CdrEnergyClient, compareEnergyPlans, estimateAnnualCost, type PlanDetail } from "@/lib/integrations/cdr-energy";
import type { EmailProvider } from "@/lib/integrations/notifications";
import { disabledPayments, paymentProvider } from "@/lib/integrations/payments";
import { notify } from "@/lib/services/context";
import { compareEnergy } from "@/lib/services/pricing";
import { IDS } from "@/lib/store/seed";
import { alex, makeCtx } from "./helpers";

const single = (supply: string, rates: { unitPrice: string; volume?: number }[], period = "P1D"): PlanDetail => ({
  planId: "P1", brand: "x", brandName: "X Energy", displayName: "Flat", type: "MARKET", fuelType: "ELECTRICITY",
  electricityContract: { tariffPeriod: [{ rateBlockUType: "singleRate", dailySupplyCharge: supply, singleRate: { rates, period } }] },
});

describe("energy cost estimates", () => {
  it("costs a flat single-rate tariff (supply + usage, plus GST)", () => {
    // ($1.00/day + 10 kWh × $0.30) × 365 × 1.1 = $1,606.00
    expect(estimateAnnualCost(single("1.00", [{ unitPrice: "0.30" }]), 10, 0.1)).toBe(160_600);
  });
  it("applies volume blocks within their period", () => {
    // First 5 kWh/day at 0.20, rest at 0.40; 10 kWh/day: (0 + 5×0.2 + 5×0.4) × 365 = 1095.00
    expect(estimateAnnualCost(single("0", [{ unitPrice: "0.20", volume: 5 }, { unitPrice: "0.40" }]), 10, 0)).toBe(109_500);
  });
  it("refuses to cost tariffs it doesn't model, instead of guessing", () => {
    const tou: PlanDetail = { ...single("1", [{ unitPrice: "0.3" }]), electricityContract: { tariffPeriod: [{ rateBlockUType: "timeOfUseRates", dailySupplyCharge: "1" }] } };
    expect(estimateAnnualCost(tou, 10, 0.1)).toBeNull();
    const seasonal: PlanDetail = { ...single("1", [{ unitPrice: "0.3" }]), electricityContract: { tariffPeriod: [single("1", [{ unitPrice: "0.3" }]).electricityContract!.tariffPeriod![0], single("1", [{ unitPrice: "0.4" }]).electricityContract!.tariffPeriod![0]] } };
    expect(estimateAnnualCost(seasonal, 10, 0.1)).toBeNull();
    expect(estimateAnnualCost(single("1", [{ unitPrice: "0.2", volume: 5 }]), 10, 0)).toBeNull(); // usage beyond the last block
  });
});

function fakeFetch(plans: Record<string, PlanDetail[]>, failBrands: string[] = []) {
  const calls: string[] = [];
  const f = async (url: string, init?: RequestInit) => {
    calls.push(url);
    const brand = new URL(url).pathname.split("/")[1];
    if (!(init?.headers as Record<string, string>)?.["x-v"]) return new Response("missing x-v", { status: 400 });
    if (failBrands.includes(brand)) return new Response("down", { status: 503 });
    const m = url.match(/\/plans\/([^?]+)$/);
    if (m) return Response.json({ data: plans[brand].find((p) => p.planId === decodeURIComponent(m[1])) });
    return Response.json({ data: { plans: plans[brand] }, meta: { totalPages: 1 } });
  };
  return { f, calls };
}

describe("Energy Made Easy comparison (fake transport)", () => {
  const mk = (id: string, name: string, supply: string, rate: string, postcodes: string[]): PlanDetail => ({ ...single(supply, [{ unitPrice: rate }]), planId: id, displayName: name, geography: { includedPostcodes: postcodes, distributors: ["Ausgrid"] } });
  const plans = {
    a: [mk("A1", "Cheap", "1.00", "0.25", ["2000"]), mk("A2", "Cheap", "1.00", "0.25", ["2000"]), mk("A3", "Elsewhere", "0.10", "0.10", ["3000"])],
    b: [mk("B1", "Dear", "1.50", "0.35", ["2000"])],
  };

  it("filters by postcode, sorts by estimate and removes duplicate variants", async () => {
    const { f } = fakeFetch(plans);
    const r = await compareEnergyPlans(new CdrEnergyClient(f), { postcode: "2000", dailyKwh: 10, brands: ["a", "b"], taxRate: 0.1 });
    expect(r.plans.map((p) => p.planId)).toEqual(["A1", "B1"]);
    expect(r.brandsFailed).toEqual([]);
  });

  it("reports unreachable retailers instead of inventing prices, and caches lookups", async () => {
    const { f, calls } = fakeFetch(plans, ["b"]);
    const client = new CdrEnergyClient(f);
    const r = await compareEnergyPlans(client, { postcode: "2000", dailyKwh: 10, brands: ["a", "b"], taxRate: 0.1 });
    expect(r.brandsFailed).toEqual(["b"]);
    expect(r.plans.every((p) => p.brandName === "X Energy" && p.planId.startsWith("A"))).toBe(true);
    const before = calls.length;
    await compareEnergyPlans(client, { postcode: "2000", dailyKwh: 12, brands: ["a"], taxRate: 0.1 });
    expect(calls.length).toBe(before); // list + details served from cache
  });

  it("the service refuses to show anything when every source fails", async () => {
    const { f } = fakeFetch(plans, ["a", "b"]);
    process.env.CDR_ENERGY_BRANDS = "a,b";
    const ctx = { ...(await makeCtx()), energyClient: new CdrEnergyClient(f) };
    await expect(compareEnergy(ctx, alex, { postcode: "2000", dailyKwh: 10 })).rejects.toThrow(/unavailable right now/);
    await expect(compareEnergy(ctx, alex, { postcode: "20", dailyKwh: 10 })).rejects.toThrow(/postcode/);
    delete process.env.CDR_ENERGY_BRANDS;
  });
});

describe("payments are disabled", () => {
  it("never collects, and refuses unknown providers loudly", async () => {
    expect(paymentProvider()).toBe(disabledPayments);
    expect(await disabledPayments.collectFee({ transactionId: "t", customerId: "c", amountCents: 150, currency: "AUD", idempotencyKey: "fee:t" })).toMatchObject({ status: "not_collected" });
    process.env.PAYMENTS_PROVIDER = "stripe";
    expect(() => paymentProvider()).toThrow(/not implemented/);
    delete process.env.PAYMENTS_PROVIDER;
  });
});

describe("email notifications", () => {
  it("emails real users, skips demo accounts, and never fails the action", async () => {
    const sent: string[] = [];
    let fail = false;
    const provider: EmailProvider = { name: "fake", send: async (m) => { if (fail) throw new Error("SMTP down"); sent.push(m.to); } };
    const ctx = { ...(await makeCtx()), email: { provider, appUrl: "https://app.example" } };
    await ctx.store.insert("users", { id: "real-1", email: "real@example.test", name: "Real", role: "customer", permissionMode: "approval", autopilotLimitCents: 0, region: "Sydney NSW", isDemo: false, createdAt: "" });
    await notify(ctx, "real-1", { kind: "offer", title: "New offer", body: "x", href: "/app" });
    await notify(ctx, IDS.alex, { kind: "offer", title: "New offer", body: "x" });
    fail = true;
    await expect(notify(ctx, "real-1", { kind: "offer", title: "Another", body: "y" })).resolves.toBeUndefined();
    expect(sent).toEqual(["real@example.test"]);
    const log = await ctx.store.list("notifications");
    expect(log.map((l) => l.status).sort()).toEqual(["failed", "sent", "skipped"]);
    expect((await ctx.store.list("alerts", { userId: "real-1" }))).toHaveLength(2); // in-app always recorded
  });
});
