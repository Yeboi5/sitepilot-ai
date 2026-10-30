import { formatAud, formatRatio } from "@/lib/format";
import type { PropertyResult } from "./engine";

/**
 * Quick Compare (simple view): the user picks what matters to them, and each property is ranked
 * on those measures alone. Transparent and deterministic: for each priority with at least two known
 * values, the best property gets 1 point and the worst 0 (evenly spaced between). Unknown values
 * get no points and are named. Not a prediction or advice.
 */
export const QUICK_VERSION = "quick-match-1.0.0";

export type QuickInput = {
  id: string;
  label: string;
  result: PropertyResult;
  bedrooms: number | null;
  landAreaSqm: number | null;
};

type Pick = { label: string; short: string; better: "high" | "low"; value: (p: QuickInput) => number | null; show: (n: number) => string };

const v = (m: { known: boolean; value?: number }) => (m.known ? m.value! : null);

export const PRIORITIES = {
  lowest_repayments: {
    label: "Lowest repayments",
    short: "lowest repayments",
    better: "low",
    value: (p) => (p.result.annualRepayments.known ? p.result.annualRepayments.value / 12 : null),
    show: (n) => `${formatAud(n)}/month`,
  },
  lowest_price: { label: "Lowest price", short: "lowest price", better: "low", value: (p) => v(p.result.price), show: formatAud },
  rental_return: { label: "Rental return", short: "best rental return", better: "high", value: (p) => v(p.result.grossYield), show: (n) => `${formatRatio(n)} gross yield` },
  cash_flow: { label: "Cash flow", short: "strongest cash flow", better: "high", value: (p) => v(p.result.cashFlowYear1), show: (n) => `${formatAud(n)} in year 1` },
  low_upfront: { label: "Least cash up front", short: "least cash up front", better: "low", value: (p) => v(p.result.cashRequired), show: formatAud },
  space: { label: "More bedrooms", short: "most bedrooms", better: "high", value: (p) => p.bedrooms, show: (n) => `${n} bedrooms` },
  land: { label: "Bigger block", short: "biggest block", better: "high", value: (p) => p.landAreaSqm, show: (n) => `${n.toLocaleString("en-AU")} m²` },
} satisfies Record<string, Pick>;
export type Priority = keyof typeof PRIORITIES;
export const PRIORITY_IDS = Object.keys(PRIORITIES) as Priority[];

export const DEFAULT_PRIORITIES: Record<"homebuyer" | "investor", Priority[]> = {
  homebuyer: ["lowest_repayments", "space"],
  investor: ["rental_return", "cash_flow"],
};

export type QuickMatch = {
  ranking: { id: string; label: string; points: number; wins: Priority[] }[];
  best: { id: string; label: string } | null;
  tie: boolean;
  explanation: string[];
};

export function quickMatch(props: QuickInput[], priorities: Priority[]): QuickMatch {
  const points = new Map(props.map((p) => [p.id, 0]));
  const wins = new Map<string, Priority[]>(props.map((p) => [p.id, []]));
  const notes: string[] = [];
  const used: Priority[] = [];

  for (const id of priorities) {
    const pr: Pick = PRIORITIES[id];
    const known = props.map((p) => ({ p, x: pr.value(p) })).filter((k): k is { p: QuickInput; x: number } => k.x != null);
    const missing = props.filter((p) => pr.value(p) == null).map((p) => p.label);
    if (known.length < 2) {
      notes.push(`${pr.label}: not enough data to compare${missing.length ? ` (unknown for ${missing.join(", ")})` : ""}.`);
      continue;
    }
    used.push(id);
    const sorted = [...known].sort((a, b) => (pr.better === "high" ? b.x - a.x : a.x - b.x));
    const bestX = sorted[0]!.x;
    const worstX = sorted.at(-1)!.x;
    for (const k of known) {
      // Linear between best (1) and worst (0); equal values score the same.
      const share = bestX === worstX ? 1 : (k.x - worstX) / (bestX - worstX);
      points.set(k.p.id, points.get(k.p.id)! + share);
      if (k.x === bestX) wins.get(k.p.id)!.push(id);
    }
    if (missing.length) notes.push(`${pr.label} is unknown for ${missing.join(", ")}, so ${missing.length === 1 ? "it gets" : "they get"} no points for it.`);
  }

  const ranking = props
    .map((p) => ({ id: p.id, label: p.label, points: Math.round(points.get(p.id)! * 100) / 100, wins: wins.get(p.id)! }))
    .sort((a, b) => b.points - a.points);
  const explanation: string[] = [];
  if (!used.length) {
    return { ranking, best: null, tie: false, explanation: ["Pick at least one priority with enough data to find a match.", ...notes] };
  }
  const [top, second] = [ranking[0]!, ranking[1]];
  const tie = second != null && Math.abs(top.points - second.points) < 0.05;
  const detail = (id: string, ps: Priority[]) =>
    ps.map((pid) => `${PRIORITIES[pid].short} (${PRIORITIES[pid].show(PRIORITIES[pid].value(props.find((p) => p.id === id)!)!)})`).join(" and ");
  if (tie) {
    explanation.push(`${top.label} and ${second!.label} are an even match for your priorities. Open the advanced view to dig deeper.`);
  } else {
    explanation.push(
      top.wins.length
        ? `${top.label} best matches your priorities, with the ${detail(top.id, top.wins)}.`
        : `${top.label} best matches your priorities overall, without being first on any single one.`,
    );
  }
  for (const r of ranking.slice(tie ? 2 : 1)) {
    if (r.wins.length) explanation.push(`${r.label} has the ${detail(r.id, r.wins)}.`);
  }
  explanation.push(...notes);
  return { ranking, best: tie ? null : { id: top.id, label: top.label }, tie, explanation };
}
