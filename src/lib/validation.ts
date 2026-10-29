import { z } from "zod";

const trimmed = (max: number) => z.string().trim().min(1, "Required").max(max, `Must be ${max} characters or fewer`);

export const signUpSchema = z.object({
  displayName: trimmed(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z
    .string()
    .min(12, "Use at least 12 characters")
    .max(128)
    .refine((p) => /[a-z]/i.test(p) && /[0-9]/.test(p), "Include at least one letter and one number"),
});

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Required").max(128),
});

export const organisationSchema = z.object({
  name: trimmed(160),
  type: z.enum(["investor", "professional"]),
});

// NSW postcodes: 2000–2599, 2619–2899, 2921–2999 (2600–2618 & 2900–2920 are ACT) plus PO-box range 1000–1999.
export function isNswPostcode(postcode: string): boolean {
  if (!/^\d{4}$/.test(postcode)) return false;
  const n = Number(postcode);
  return (n >= 1000 && n <= 2599) || (n >= 2619 && n <= 2899) || (n >= 2921 && n <= 2999);
}

export const propertySchema = z.object({
  address: z.string().trim().min(3, "Enter the street address").max(300),
  suburb: trimmed(80),
  postcode: z.string().trim().refine(isNswPostcode, "Enter a valid NSW postcode"),
  lotDp: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v ? v : null)),
});

export const EVIDENCE_SOURCE_TYPES = [
  "planning_certificate",
  "planning_portal",
  "lep_map",
  "council_record",
  "title_search",
  "survey",
  "other",
] as const;

export const EVIDENCE_SOURCE_LABELS: Record<(typeof EVIDENCE_SOURCE_TYPES)[number], string> = {
  planning_certificate: "Planning certificate (council)",
  planning_portal: "NSW Planning Portal record",
  lep_map: "LEP map / instrument",
  council_record: "Council record",
  title_search: "Title search",
  survey: "Survey",
  other: "Other",
};

export const evidenceSchema = (today: Date = new Date()) =>
  z.object({
    title: trimmed(200),
    sourceType: z.enum(EVIDENCE_SOURCE_TYPES),
    sourceUrl: z
      .string()
      .trim()
      .max(2000)
      .url("Enter a full URL")
      .refine((u) => u.startsWith("https://"), "Only https:// sources are accepted"),
    fetchedAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the date you retrieved it")
      .refine((d) => !Number.isNaN(Date.parse(d)), "Enter a valid date")
      .refine((d) => d <= today.toISOString().slice(0, 10), "Retrieval date can't be in the future"),
    notes: z
      .string()
      .trim()
      .max(4000)
      .optional()
      .transform((v) => (v ? v : null)),
  });

export type FieldErrors = Record<string, string[] | undefined>;

export type FormState = { error?: string; fieldErrors?: FieldErrors; message?: string } | undefined;

export function formDataToObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  formData.forEach((value, key) => {
    if (typeof value === "string" && !key.startsWith("$ACTION")) out[key] = value;
  });
  return out;
}
