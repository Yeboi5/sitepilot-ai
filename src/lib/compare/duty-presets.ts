import { z } from "zod";
import { dutyBracketsSchema } from "./duty";

/**
 * Stamp duty presets as entered from each state's official revenue office (reference data for
 * duty_presets). Only the official domain for the state is accepted as a source, and every new
 * entry starts as "needs_review" until a person confirms it against that source.
 */
export const OFFICIAL_DUTY_DOMAINS: Record<string, string> = {
  NSW: "www.revenue.nsw.gov.au",
  VIC: "www.sro.vic.gov.au",
  QLD: "qro.qld.gov.au",
  WA: "www.wa.gov.au",
  SA: "www.revenuesa.sa.gov.au",
  TAS: "www.sro.tas.gov.au",
  ACT: "www.revenue.act.gov.au",
  NT: "treasury.nt.gov.au",
};

export const dutyPresetSchema = z
  .object({
    state: z.enum(["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"]),
    version: z.string().regex(/^[A-Za-z0-9._-]{1,40}$/),
    brackets: dutyBracketsSchema,
    source_url: z.string().url(),
    as_of: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    status: z.enum(["needs_review", "reviewed"]).default("needs_review"),
    reviewed_by: z.string().min(1).max(120).optional(),
    reviewed_at: z.string().datetime().optional(),
    notes: z.string().max(1000).optional(),
  })
  .refine((p) => {
    try {
      const u = new URL(p.source_url);
      return u.protocol === "https:" && u.hostname === OFFICIAL_DUTY_DOMAINS[p.state];
    } catch {
      return false;
    }
  }, "source_url must be on the state's official revenue office website")
  .refine((p) => (p.status === "reviewed") === Boolean(p.reviewed_by && p.reviewed_at), "a reviewed preset needs reviewed_by and reviewed_at (and only then)");
export type DutyPresetInput = z.infer<typeof dutyPresetSchema>;

export const dutyPresetFileSchema = z.array(dutyPresetSchema).refine((xs) => new Set(xs.map((x) => `${x.state}/${x.version}`)).size === xs.length, "state + version must be unique");
