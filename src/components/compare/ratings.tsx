import { GOALS, GOAL_IDS, type Goal, type Rating } from "@/lib/compare/goals";

/** Four dots and a word, e.g. ●●●○ Good. Screen readers hear "Good, 3 of 4". */
export function Dots({ rating }: { rating: Rating }) {
  if (!rating.dots) return <span className="text-slate-500">{rating.word}</span>;
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span aria-hidden="true" className="tracking-[0.15em] text-brand-600">
        {"●".repeat(rating.dots)}
        <span className="text-sand-300">{"●".repeat(4 - rating.dots)}</span>
      </span>
      <span className="font-semibold">{rating.word}</span>
      <span className="sr-only">, {rating.dots} of 4</span>
    </span>
  );
}

/** "What's your goal?" One tap; the weighting happens behind the scenes. */
export function GoalPicker({ goal, onChange }: { goal: Goal; onChange: (g: Goal) => void }) {
  return (
    <div role="radiogroup" aria-label="Your goal" className="flex flex-wrap gap-2">
      {GOAL_IDS.map((g) => (
        <button
          key={g}
          type="button"
          role="radio"
          aria-checked={goal === g}
          onClick={() => onChange(g)}
          className="min-h-11 rounded-2xl border border-sand-300 bg-white px-4 py-1.5 text-left text-sm aria-checked:border-brand-600 aria-checked:bg-brand-600 aria-checked:text-white"
        >
          <span className="block font-semibold">{GOALS[g].label}</span>
          <span className="block text-xs opacity-80">{GOALS[g].hint}</span>
        </button>
      ))}
    </div>
  );
}
