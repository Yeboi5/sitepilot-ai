import { z } from "zod";

/** Safely decodes an AI draft passed through the URL (never trusted for anything but form defaults). */
export function decodeDraft<T extends z.ZodType>(raw: string | undefined, schema: T): z.infer<T> | undefined {
  if (!raw || raw.length > 8000) return undefined;
  try {
    const parsed = schema.safeParse(JSON.parse(Buffer.from(raw, "base64url").toString()));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

export const BidDraft = z.object({
  priceCents: z.number().int().positive(),
  scope: z.string().max(4000),
  materials: z.string().max(1000),
  warrantyMonths: z.number().int().min(0).max(600),
  completionDays: z.number().int().min(0).max(365),
  rationale: z.string().max(2000),
  provider: z.string().max(100),
  simulated: z.boolean(),
});

export const CounterDraft = z.object({
  priceCents: z.number().int().positive(),
  message: z.string().max(4000),
  lastAsk: z.number().int(),
});
