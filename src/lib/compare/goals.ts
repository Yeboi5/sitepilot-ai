import { formatAud, formatRatio } from "@/lib/format";
import type { Row } from "./explain";
import { MIN_COVERAGE, type Category, type Weights } from "./score";

/**
 * Plain-language Compare (replaces the visible 0–100 score and weight sliders). The user picks a
 * goal; each goal sets the scoring weights behind the scenes. Properties get a rating per area
 * (dots and a word) and one verdict sentence. The deterministic score still decides the order and
 * is documented in "How we worked this out", but no number out of 100 is shown.
 */
export const GOALS = {
  balanced: {
    label: "Balanced",
    hint: "A bit of everything",
    weights: { rental_return: 20, affordability: 20, development: 15, market: 20, risk: 20, completeness: 5 },
  },
  capital_growth: {
    label: "Capital growth",
    hint: "Values rising over time",
    weights: { rental_return: 10, affordability: 15, development: 15, market: 40, risk: 15, completeness: 5 },
  },
  rental_income: {
    label: "Rental income",
    hint: "Rent covering the costs",
    weights: { rental_return: 40, affordability: 30, development: 5, market: 10, risk: 10, completeness: 5 },
  },
  lower_risk: {
    label: "Lower risk",
    hint: "Fewer unknowns, safer cash flow",
    weights: { rental_return: 10, affordability: 25, development: 5, market: 15, risk: 35, completeness: 10 },
  },
  development: {
    label: "Development",
    hint: "Room to build or subdivide",
    weights: { rental_return: 5, affordability: 15, development: 45, market: 15, risk: 15, completeness: 5 },
  },
} satisfies Record<string, { label: string; hint: string; weights: Weights }>;
export type Goal = keyof typeof GOALS;
export const GOAL_IDS = Object.keys(GOALS) as Goal[];

/** The goal whose weights these are (saved comparisons store weights); Balanced if none match. */
export function goalFromWeights(w: Weights): Goal {
  return GOAL_IDS.find((g) => (Object.keys(w) as Category[]).every((c) => GOALS[g].weights[c] === w[c])) ?? "balanced";
}

export const AREA_LABEL: Record<Category, string> = {
  rental_return: "Rental income",
  affordability: "Cash flow",
  market: "Suburb growth",
  risk: "Risk",
  development: "Development",
  completeness: "Data quality",
};
/** Display order of the rating rows. */
export const AREAS: Category[] = ["rental_return", "affordability", "market", "risk", "development", "completeness"];

export type Rating = { dots: 0 | 1 | 2 | 3 | 4; word: string };

/** 0–100 component score → 1–4 dots and a word. Risk uses concern wording. Unknown → no dots. */
export function rate(score: number | null, area: Category | "overall"): Rating {
  if (score == null) return { dots: 0, word: "Not enough info" };
  const dots = (score >= 75 ? 4 : score >= 50 ? 3 : score >= 25 ? 2 : 1) as Rating["dots"];
  const words = area === "risk" ? ["", "Many concerns", "Several concerns", "Some concerns", "Few concerns"] : ["", "Weak", "Fair", "Good", "Strong"];
  return { dots, word: words[dots]! };
}

/** How much each area counts for a goal, in words (for "How we worked this out"). */
export function importance(goal: Goal, area: Category): string {
  const w = GOALS[goal].weights[area];
  return w >= 30 ? "Matters most" : w >= 15 ? "Important" : w > 0 ? "Counts a little" : "Not used";
}

/** A short, figure-backed phrase for why a row does well in an area. */
function strength(r: Row, area: Category): string | null {
  const res = r.result;
  switch (area) {
    case "rental_return":
      return res.grossYield.known ? `stronger rent (${formatRatio(res.grossYield.value)} gross yield)` : null;
    case "affordability":
      if (!res.cashFlowYear1.known) return null;
      return res.cashFlowYear1.value >= 0
        ? `better cash flow (${formatAud(res.cashFlowYear1.value)} in year 1)`
        : `a smaller cash shortfall (${formatAud(res.cashFlowYear1.value)} in year 1)`;
    case "market":
      return r.suburb?.growth
        ? `stronger suburb growth (${formatRatio(r.suburb.growth.perYear)} a year over ${r.suburb.growth.years} year${r.suburb.growth.years === 1 ? "" : "s"}, ${r.suburb.growth.toCount} recent sales)`
        : null;
    case "risk":
      return "fewer concerns";
    case "development":
      return "a development scenario backed by verified planning evidence";
    case "completeness":
      return "more complete information";
  }
}

export type Verdict = { leaderId: string | null; text: string };

/**
 * One sentence for the chosen goal. A leader is named only when it has enough evidence (coverage)
 * and clearly beats the next property; otherwise the sentence says why not.
 */
export function verdict(rows: Row[], goal: Goal, checks: Record<string, string | undefined> = {}): Verdict {
  const label = GOALS[goal].label.toLowerCase();
  const scored = rows.filter((r) => r.score.score != null).sort((a, b) => b.score.score! - a.score.score!);
  if (!scored.length) {
    return { leaderId: null, text: `Not enough verified information to rank these reliably for ${label}. Add a price, rent or stamp duty to fill the gaps.` };
  }
  const [top, next] = [scored[0]!, scored[1]];
  if (top.score.coverage < MIN_COVERAGE) return { leaderId: null, text: `Not enough verified information to rank these reliably for ${label}.` };
  if (next && top.score.score! - next.score.score! < 3) {
    return { leaderId: null, text: `${top.label} and ${next.label} are a close call for ${label}. Open "How we worked this out" to see where each one is stronger.` };
  }
  // The leader's best areas among those that matter for this goal, where it beats every other scored property.
  const others = rows.filter((r) => r.id !== top.id);
  const wins = AREAS.filter((a) => GOALS[goal].weights[a] >= 15)
    .filter((a) => {
      const mine = top.score.components.find((c) => c.category === a)?.score;
      return mine != null && others.every((o) => (o.score.components.find((c) => c.category === a)?.score ?? -1) < mine);
    })
    .sort((a, b) => GOALS[goal].weights[b] - GOALS[goal].weights[a])
    .map((a) => strength(top, a))
    .filter((x): x is string => !!x)
    .slice(0, 2);
  const why = wins.length ? `: ${wins.join(" and ")}` : "";
  const check = checks[top.id] ? ` Check: ${checks[top.id]}.` : "";
  return { leaderId: top.id, text: `For ${label}, ${top.label} suits you best${why}.${check}` };
}

/** The figure needed for each rating word in an area (from the score's fixed bands), for the explainer. */
export function ratingThresholds(lo: number, hi: number): { strong: number; good: number; fair: number } {
  const at = (t: number) => lo + (hi - lo) * t;
  return { strong: at(0.75), good: at(0.5), fair: at(0.25) };
}
