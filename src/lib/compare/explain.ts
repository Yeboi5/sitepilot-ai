import { formatAud, formatRatio } from "@/lib/format";
import type { CompareAssumptions } from "./assumptions";
import type { Metric, PropertyResult } from "./engine";
import { CATEGORY_LABELS, type ScoreResult } from "./score";

/**
 * "Why these results?" and question templates (Blueprint v2.1). Every sentence is generated from
 * the engine's numbers; nothing here estimates anything. An AI narrator, if added later, may only
 * rephrase these facts.
 */
export type Row = { id: string; label: string; result: PropertyResult; score: ScoreResult };

const val = (m: Metric) => (m.known ? m.value : null);

function best(rows: Row[], pick: (r: Row) => number | null, dir: "max" | "min" = "max") {
  const known = rows.map((r) => ({ r, v: pick(r) })).filter((x): x is { r: Row; v: number } => x.v != null);
  if (!known.length) return null;
  return known.reduce((a, b) => ((dir === "max" ? b.v > a.v : b.v < a.v) ? b : a));
}

export type Question = { id: string; question: string; answer: (rows: Row[], a: CompareAssumptions) => string };

export const QUESTIONS: Question[] = [
  {
    id: "net_return",
    question: "Which property has the highest projected net return over my holding period?",
    answer: (rows, a) => {
      const b = best(rows, (r) => (r.result.projections ? val(r.result.projections.base.netReturn) : null));
      return b
        ? `${b.r.label}: ${formatAud(b.v)} over ${a.holdingYears} years in the base scenario (${a.growthPct.base}% growth a year, your assumption). This is pre-tax, before selling costs, and not a forecast.`
        : "None of these properties has enough data (price and rent) to project a net return.";
    },
  },
  {
    id: "cash_flow_stress",
    question: "Which has the best cash flow if interest rates rise 2%?",
    answer: (rows, a) => {
      const b = best(rows, (r) => val(r.result.rateSensitivity.find((s) => s.shiftPp === 2)!.cashFlow));
      return b
        ? `${b.r.label}: ${formatAud(b.v)} in year 1 at ${(a.interestRatePct + 2).toFixed(2)}%, pre-tax.`
        : "Cash flow can't be calculated without a price and a rent estimate.";
    },
  },
  {
    id: "cash_required",
    question: "Which needs the least cash up front?",
    answer: (rows, a) => {
      const b = best(rows, (r) => val(r.result.cashRequired), "min");
      return b
        ? `${b.r.label}: ${formatAud(b.v)} (a ${a.depositPct}% deposit, stamp duty and other purchase costs).`
        : "Cash required needs a price and a stamp duty figure for each property.";
    },
  },
  {
    id: "gross_yield",
    question: "Which has the highest gross rental yield?",
    answer: (rows) => {
      const b = best(rows, (r) => val(r.result.grossYield));
      return b ? `${b.r.label}: ${formatRatio(b.v)} (annual rent ÷ price).` : "No property here has both a price and a rent estimate.";
    },
  },
];

/** Bullet points explaining the ranking and the gaps. */
export function explain(rows: Row[], a: CompareAssumptions): string[] {
  const out: string[] = [];
  const scored = rows.filter((r) => r.score.score != null).sort((x, y) => y.score.score! - x.score.score!);
  if (scored.length >= 2) {
    const [top, next] = [scored[0]!, scored[1]!];
    const diffs = top.score.components
      .map((c) => {
        const other = next.score.components.find((o) => o.category === c.category)!;
        return c.score != null && other.score != null ? { c, d: (c.score - other.score) * c.weight } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x != null && x.d > 0)
      .sort((x, y) => y.d - x.d);
    const why = diffs.slice(0, 2).map((x) => CATEGORY_LABELS[x.c.category].toLowerCase());
    out.push(
      `${top.label} ranks first with ${top.score.score}/100${why.length ? `, mainly on ${why.join(" and ")}` : ""}, ahead of ${next.label} (${next.score.score}/100) under your weights.`,
    );
  } else if (scored.length === 1) {
    out.push(`Only ${scored[0]!.label} has enough evidence for a score (${scored[0]!.score.score}/100).`);
  } else {
    out.push("None of these properties has enough evidence for a score yet. Add a stamp duty figure, or rent and price, to fill the gaps.");
  }
  for (const q of QUESTIONS.slice(0, 3)) out.push(q.answer(rows, a));

  const unscored = rows.filter((r) => r.score.score == null).map((r) => r.label);
  if (unscored.length && scored.length) out.push(`Not scored (not enough evidence): ${unscored.join(", ")}.`);
  out.push("Development feasibility and price history are excluded until there's verified planning evidence and licensed market data.");
  return out;
}
