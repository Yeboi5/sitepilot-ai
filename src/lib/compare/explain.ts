import { formatAud, formatRatio } from "@/lib/format";
import { smallSampleWarning, type SuburbSnapshot } from "@/lib/suburbs/stats";
import type { CompareAssumptions } from "./assumptions";
import type { Metric, PropertyResult } from "./engine";
import { AREA_LABEL } from "./goals";
import type { ScoreResult } from "./score";

/**
 * "Why these results?" and question templates (Blueprint v2.1). Every sentence is generated from
 * the engine's numbers; nothing here estimates anything. An AI narrator, if added later, may only
 * rephrase these facts.
 */
export type Row = { id: string; label: string; result: PropertyResult; score: ScoreResult; suburb?: SuburbSnapshot | null };

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
    id: "suburb_growth",
    question: "Which property's suburb has shown the strongest price growth?",
    answer: (rows) => {
      const b = best(rows, (r) => r.suburb?.growth?.perYear ?? null);
      if (!b) return "None of these properties has suburb sales history for its type yet.";
      const s = b.r.suburb!;
      const g = s.growth!;
      return `${b.r.label}: ${s.suburb} ${s.type} medians grew ${formatRatio(g.perYear)} a year over ${g.years} year${g.years === 1 ? "" : "s"} (${g.fromCount} sales then, ${g.toCount} now${s.isDemo ? ", DEMO figures" : ""}). That's historical, not a forecast.`;
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
    const why = diffs.slice(0, 2).map((x) => AREA_LABEL[x.c.category].toLowerCase());
    out.push(
      `${top.label} ranks ahead of ${next.label} for your goal${why.length ? `, mainly on ${why.join(" and ")}` : ""}.`,
    );
  } else if (scored.length === 1) {
    out.push(`Only ${scored[0]!.label} has enough evidence to be ranked.`);
  } else {
    out.push("None of these properties has enough evidence to be ranked yet. Add a stamp duty figure, or rent and price, to fill the gaps.");
  }
  for (const q of QUESTIONS.slice(0, 3)) out.push(q.answer(rows, a));

  const unscored = rows.filter((r) => r.score.score == null).map((r) => r.label);
  if (unscored.length && scored.length) out.push(`Not scored (not enough evidence): ${unscored.join(", ")}.`);
  for (const r of rows) {
    const w = r.suburb ? smallSampleWarning(r.label, r.suburb) : null;
    if (w) out.push(w);
  }
  const devMissing = rows.filter((r) => r.score.components.find((c) => c.category === "development")?.score == null).map((r) => r.label);
  out.push(
    devMissing.length === rows.length
      ? "Development feasibility is excluded until there's verified planning evidence and a complete scenario."
      : devMissing.length
        ? `Development feasibility is scored only where there's verified planning evidence and a complete scenario (not yet for ${devMissing.join(", ")}).`
        : "Development feasibility uses each property's scenario and verified planning evidence.",
  );
  const noHistory = rows.filter((r) => r.score.components.find((c) => c.category === "market")?.score == null).map((r) => r.label);
  if (noHistory.length) out.push(`Historical market indicators use suburb sales for the property's type; none yet for ${noHistory.join(", ")}.`);
  return out;
}
