import { z } from "zod";
import { compareAssumptionsSchema, DEFAULT_ASSUMPTIONS, propertyOverridesSchema } from "./assumptions";
import { CATEGORIES, DEFAULT_WEIGHTS, type Weights } from "./score";

/** The user-editable state of one comparison (saved as comparison_sets/items/assumptions). */
export const weightsSchema = z.object(Object.fromEntries(CATEGORIES.map((c) => [c, z.number().min(0).max(100)])) as Record<(typeof CATEGORIES)[number], z.ZodNumber>);

export const compareStateSchema = z.object({
  name: z.string().trim().min(1, "Give it a name").max(80),
  mode: z.enum(["homebuyer", "investor"]),
  listingIds: z.array(z.string().uuid()).min(2, "Choose at least 2 properties").max(5, "Compare up to 5 properties"),
  assumptions: compareAssumptionsSchema,
  weights: weightsSchema,
  overrides: z.record(z.string().uuid(), propertyOverridesSchema),
});
export type CompareState = z.infer<typeof compareStateSchema>;

export function initialState(listingIds: string[], mode: CompareState["mode"] = "investor"): CompareState {
  return { name: "My comparison", mode, listingIds, assumptions: DEFAULT_ASSUMPTIONS, weights: DEFAULT_WEIGHTS as Weights, overrides: {} };
}
