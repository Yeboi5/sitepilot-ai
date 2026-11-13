import type { Cents } from "./money";
import type { Alert, PriceWatch } from "./types";

export type WatchSignal = Omit<Alert, "id" | "userId" | "read" | "createdAt">;

const DAY = 86_400_000;

export function currentPrice(w: PriceWatch): Cents {
  return w.history.length ? w.history[w.history.length - 1].cents : w.purchasePriceCents;
}

/**
 * Evaluates a watch and returns the alerts it should raise. Pure function:
 * the caller de-duplicates and persists. Only data from manual entry,
 * approved APIs, or the clearly-labelled simulated feed is used — no scraping.
 */
export function evaluateWatch(w: PriceWatch, now = new Date()): WatchSignal[] {
  const out: WatchSignal[] = [];
  const price = currentPrice(w);
  const base = { watchId: w.id, href: `/app/monitor#${w.id}` };

  if (w.kind === "retail_product") {
    const drop = w.purchasePriceCents - price;
    if (drop > 0 && w.purchasedAt && w.adjustmentWindowDays) {
      const daysSince = Math.floor((now.getTime() - new Date(w.purchasedAt).getTime()) / DAY);
      if (daysSince <= w.adjustmentWindowDays) {
        out.push({ ...base, kind: "adjustment_eligible", title: `Possible price adjustment: ${w.label}`, body: `Now ${price / 100} at ${w.merchant}, ${drop / 100} less than you paid ${daysSince} days ago. Their stated window is ${w.adjustmentWindowDays} days — confirm the retailer's policy and request an adjustment with your receipt.`, potentialSavingsCents: drop });
      } else {
        out.push({ ...base, kind: "price_drop", title: `Price dropped: ${w.label}`, body: `Now ${drop / 100} below what you paid, but outside the adjustment window.`, potentialSavingsCents: 0 });
      }
    }
    if (w.targetPriceCents !== undefined && price <= w.targetPriceCents) {
      out.push({ ...base, kind: "target_reached", title: `Target price reached: ${w.label}`, body: `Now ${price / 100}, at or below your target of ${w.targetPriceCents / 100}.` });
    }
  }

  if (w.kind === "bill" || w.kind === "subscription") {
    const prev = w.history.length >= 2 ? w.history[w.history.length - 2].cents : w.purchasePriceCents;
    if (price > prev) {
      const pct = Math.round(((price - prev) / prev) * 1000) / 10;
      out.push({ ...base, kind: "bill_increase", title: `${w.label} went up ${pct}%`, body: `From ${prev / 100} to ${price / 100} per period. DealPilot can negotiate this for you.`, potentialSavingsCents: price - prev, href: `/app/negotiations/new?watch=${w.id}` });
    }
  }

  if (w.renewalDate) {
    const days = Math.ceil((new Date(w.renewalDate).getTime() - now.getTime()) / DAY);
    if (days >= 0 && days <= 30) {
      out.push({ ...base, kind: "renewal_due", title: `${w.label} renews in ${days} days`, body: w.kind === "contract" ? "Contract ends soon — compare alternatives before it rolls over." : "Review before it renews automatically." });
    }
  }
  return out;
}

/** Stable key used to avoid raising the same alert twice. */
export function alertKey(s: WatchSignal, price: Cents): string {
  return `${s.watchId}:${s.kind}:${price}`;
}
