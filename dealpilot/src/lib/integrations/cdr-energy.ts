/**
 * Energy plans from the Australian Energy Regulator's Energy Made Easy, published under the
 * Consumer Data Right as Product Reference Data (public, unauthenticated, government-hosted).
 *   https://cdr.energymadeeasy.gov.au/{retailer}/cds-au/v1/energy/plans
 *
 * This is genuine, authorised data. It is used to ESTIMATE annual costs for single-rate tariffs;
 * the estimate is labelled as such and never presented as a quote.
 */
import type { Cents } from "../domain/money";

const BASE = "https://cdr.energymadeeasy.gov.au";
export const DEFAULT_BRANDS = ["agl", "origin", "energyaustralia", "red-energy", "alinta", "powershop", "momentum", "ovo-energy", "dodo", "amber"];

export interface PlanSummary {
  planId: string;
  brand: string;
  brandName: string;
  displayName: string;
  type: string;
  customerType?: string;
  fuelType: string;
  geography?: { distributors?: string[]; includedPostcodes?: string[] };
}

interface RateBlock { unitPrice: string; volume?: number }
interface TariffPeriod {
  rateBlockUType: string;
  dailySupplyCharge?: string;
  singleRate?: { rates: RateBlock[]; period?: string };
}
export interface PlanDetail extends PlanSummary {
  lastUpdated?: string;
  electricityContract?: {
    pricingModel?: string;
    tariffPeriod?: TariffPeriod[];
    isFixed?: boolean;
    discounts?: { displayName?: string; type?: string }[];
    controlledLoad?: unknown[];
    eligibility?: { type?: string; information?: string; description?: string }[] | null;
  };
}

export interface CostedPlan {
  planId: string;
  brandName: string;
  displayName: string;
  type: string;
  distributors: string[];
  dailySupplyCents: number;
  firstRateCentsPerKwh: number;
  /** Estimated annual cost in cents, including sales tax where configured. */
  estimatedAnnualCents: Cents;
  hasConditionalDiscounts: boolean;
  /** Published eligibility conditions (e.g. membership). Shown verbatim; never inferred. */
  eligibility: string[];
  hasControlledLoad: boolean;
  lastUpdated?: string;
}

const PERIOD_DAYS: Record<string, number> = { P1D: 1, P1W: 7, P1M: 365 / 12, P3M: 365 / 4, P1Y: 365 };

/**
 * Annual cost of a single-rate tariff for `dailyKwh` usage. Volume blocks apply per their period
 * (e.g. the first 10 kWh per day). Returns null for tariff structures this estimator doesn't cost
 * (time-of-use, demand, flexible), rather than guessing.
 */
export function estimateAnnualCost(plan: PlanDetail, dailyKwh: number, taxRate: number): number | null {
  const periods = plan.electricityContract?.tariffPeriod ?? [];
  if (periods.length !== 1) return null; // seasonal tariffs need date-weighted costing
  const tp = periods[0];
  if (tp.rateBlockUType !== "singleRate" || !tp.singleRate?.rates?.length || tp.dailySupplyCharge === undefined) return null;
  const supply = Number(tp.dailySupplyCharge);
  if (!Number.isFinite(supply)) return null;
  const days = PERIOD_DAYS[tp.singleRate.period ?? "P1D"] ?? 1;
  let remaining = dailyKwh * days;
  let usageCost = 0;
  for (const r of tp.singleRate.rates) {
    const price = Number(r.unitPrice);
    if (!Number.isFinite(price)) return null;
    const kwh = r.volume !== undefined ? Math.min(remaining, r.volume) : remaining;
    usageCost += kwh * price;
    remaining -= kwh;
    if (remaining <= 0) break;
  }
  if (remaining > 0) return null;
  const annualDollars = (supply * 365 + (usageCost / days) * 365) * (1 + taxRate);
  return Math.round(annualDollars * 100);
}

export interface FetchLike { (url: string, init?: RequestInit): Promise<Response> }

/** Small TTL cache: plan lists change at most daily, and this keeps us polite to a public API. */
class TtlCache<T> {
  private m = new Map<string, { at: number; v: Promise<T> }>();
  constructor(private ttlMs: number) {}
  get(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.m.get(key);
    if (hit && Date.now() - hit.at < this.ttlMs) return hit.v;
    const v = load().catch((e) => { this.m.delete(key); throw e; });
    this.m.set(key, { at: Date.now(), v });
    return v;
  }
}

export class CdrEnergyClient {
  private lists = new TtlCache<PlanSummary[]>(6 * 3600_000);
  private details = new TtlCache<PlanDetail>(6 * 3600_000);
  constructor(private fetchImpl: FetchLike = fetch, private timeoutMs = 20_000) {}

  private async getJson<T>(path: string, version: string): Promise<T> {
    const res = await this.fetchImpl(`${BASE}${path}`, { headers: { "x-v": version, "x-min-v": "1", accept: "application/json" }, signal: AbortSignal.timeout(this.timeoutMs) });
    if (!res.ok) throw new Error(`Energy Made Easy returned ${res.status} for ${path.split("?")[0]}`);
    return res.json() as Promise<T>;
  }

  listPlans(brand: string): Promise<PlanSummary[]> {
    if (!/^[a-z0-9-]+$/.test(brand)) return Promise.reject(new Error("Invalid brand"));
    return this.lists.get(brand, async () => {
      const out: PlanSummary[] = [];
      for (let page = 1; page <= 10; page++) {
        const body = await this.getJson<{ data: { plans: PlanSummary[] }; meta: { totalPages: number } }>(
          `/${brand}/cds-au/v1/energy/plans?page-size=1000&page=${page}&effective=CURRENT&fuelType=ELECTRICITY`, "1");
        out.push(...body.data.plans);
        if (page >= body.meta.totalPages) break;
      }
      return out;
    });
  }

  getPlan(brand: string, planId: string): Promise<PlanDetail> {
    return this.details.get(`${brand}/${planId}`, async () => (await this.getJson<{ data: PlanDetail }>(`/${brand}/cds-au/v1/energy/plans/${encodeURIComponent(planId)}`, "3")).data);
  }
}

/** Runs `fn` over items with at most `limit` in flight. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]); }
  }));
  return out;
}

export interface ComparisonResult {
  plans: CostedPlan[];
  /** Plans available at the postcode that this estimator can't cost (e.g. time-of-use). */
  notCosted: number;
  brandsFailed: string[];
  retrievedAt: string;
}

export async function compareEnergyPlans(
  client: CdrEnergyClient,
  input: { postcode: string; dailyKwh: number; brands?: string[]; taxRate: number; maxPerBrand?: number },
): Promise<ComparisonResult> {
  const brands = input.brands ?? DEFAULT_BRANDS;
  const brandsFailed: string[] = [];
  let notCosted = 0;
  const perBrand = await mapLimit(brands, 4, async (brand) => {
    try {
      const all = await client.listPlans(brand);
      const local = all.filter((p) => p.customerType !== "BUSINESS" && p.geography?.includedPostcodes?.includes(input.postcode));
      const details = await mapLimit(local.slice(0, input.maxPerBrand ?? 25), 6, (p) => client.getPlan(brand, p.planId).catch(() => null));
      const costed: CostedPlan[] = [];
      for (const d of details) {
        if (!d) continue;
        const est = estimateAnnualCost(d, input.dailyKwh, input.taxRate);
        if (est === null) { notCosted++; continue; }
        const tp = d.electricityContract!.tariffPeriod![0];
        costed.push({
          planId: d.planId, brandName: d.brandName, displayName: d.displayName, type: d.type, distributors: d.geography?.distributors ?? [],
          dailySupplyCents: Math.round(Number(tp.dailySupplyCharge) * 100 * (1 + input.taxRate) * 100) / 100,
          firstRateCentsPerKwh: Math.round(Number(tp.singleRate!.rates[0].unitPrice) * 100 * (1 + input.taxRate) * 100) / 100,
          estimatedAnnualCents: est, hasConditionalDiscounts: (d.electricityContract?.discounts?.length ?? 0) > 0, lastUpdated: d.lastUpdated,
          eligibility: (d.electricityContract?.eligibility ?? []).map((e) => e.information ?? e.description ?? e.type ?? "").filter(Boolean),
          hasControlledLoad: (d.electricityContract?.controlledLoad?.length ?? 0) > 0,
        });
      }
      return costed;
    } catch {
      brandsFailed.push(brand);
      return [];
    }
  });
  // Retailers publish near-identical variants (e.g. per meter type); show each priced offer once.
  const seen = new Set<string>();
  const plans = perBrand.flat()
    .sort((a, b) => a.estimatedAnnualCents - b.estimatedAnnualCents)
    .filter((p) => { const k = `${p.brandName}|${p.displayName}|${p.estimatedAnnualCents}`; if (seen.has(k)) return false; seen.add(k); return true; });
  return { plans, notCosted, brandsFailed, retrievedAt: new Date().toISOString() };
}
