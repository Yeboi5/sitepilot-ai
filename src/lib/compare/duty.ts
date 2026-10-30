import { z } from "zod";

/**
 * Stamp duty from a state preset (reference data loaded only from official sources; see
 * duty_presets). Brackets ascend by `from`; duty = base + (value − from) × ratePer100 ÷ 100 for the
 * highest bracket the value reaches. Concessions and surcharges are not modelled.
 */
export const dutyBracketsSchema = z
  .array(z.object({ from: z.number().min(0), base: z.number().min(0), ratePer100: z.number().min(0).max(20) }))
  .min(1)
  .refine((b) => b.every((x, i) => i === 0 || x.from > b[i - 1]!.from), "brackets must ascend")
  .refine((b) => b[0]!.from === 0, "the first bracket must start at 0");
export type DutyBrackets = z.infer<typeof dutyBracketsSchema>;

export function dutyFromBrackets(brackets: DutyBrackets, value: number): number {
  if (value <= 0) return 0;
  let chosen = brackets[0]!;
  for (const b of brackets) if (value >= b.from) chosen = b;
  return Math.round(chosen.base + ((value - chosen.from) * chosen.ratePer100) / 100);
}
