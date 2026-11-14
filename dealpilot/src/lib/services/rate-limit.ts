import { ValidationError } from "../domain/permissions";
import type { Ctx } from "./context";

export class RateLimitError extends ValidationError {
  constructor() { super("Too many attempts. Please wait a few minutes and try again."); }
}

/** Named limits so they're easy to audit and tune. */
export const LIMITS = {
  signIn: { max: 10, windowSeconds: 600 },
  signUp: { max: 5, windowSeconds: 3600 },
  upload: { max: 20, windowSeconds: 3600 },
  aiCall: { max: 60, windowSeconds: 3600 },
  mfaVerify: { max: 10, windowSeconds: 600 },
  externalPricing: { max: 30, windowSeconds: 600 },
  dataExport: { max: 5, windowSeconds: 3600 },
} as const;

/** Throws RateLimitError when every key in `keys` has exceeded the named limit. */
export async function enforceRateLimit(ctx: Ctx, name: keyof typeof LIMITS, ...keys: string[]) {
  const { max, windowSeconds } = LIMITS[name];
  for (const k of keys) {
    if (!(await ctx.store.rateLimit(`${name}:${k}`, max, windowSeconds))) throw new RateLimitError();
  }
}
