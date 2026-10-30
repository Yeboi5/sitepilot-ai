/**
 * Loads reviewed-or-pending stamp duty presets from supabase/reference/duty-presets.json into the
 * seed (between markers), after validating every entry (official source domain, ascending
 * brackets, review fields). Rates are entered by hand from each state revenue office: never from
 * memory or third-party sites.
 *
 *   npx tsx scripts/load-duty-presets.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { dutyPresetFileSchema } from "../src/lib/compare/duty-presets";

const root = path.resolve(__dirname, "..");
const parsed = dutyPresetFileSchema.safeParse(JSON.parse(readFileSync(path.join(root, "supabase/reference/duty-presets.json"), "utf8")));
if (!parsed.success) {
  console.error(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n"));
  process.exit(1);
}
const q = (s: string | undefined | null) => (s == null ? "null" : `'${s.replace(/'/g, "''")}'`);
const rows = parsed.data.map(
  (p) =>
    `  (${q(p.state)}, ${q(p.version)}, ${q(JSON.stringify(p.brackets))}::jsonb, ${q(p.source_url)}, ${q(p.as_of)}, ${q(p.status)}, ${q(p.reviewed_by)}, ${p.reviewed_at ? `${q(p.reviewed_at)}::timestamptz` : "null"}, ${q(p.notes)})`,
);
const BEGIN = "-- BEGIN DUTY PRESETS (scripts/load-duty-presets.ts)";
const END = "-- END DUTY PRESETS";
const block = `${BEGIN}\n-- ${rows.length} state preset(s) from supabase/reference/duty-presets.json\n${
  rows.length ? `insert into public.duty_presets (state, version, brackets, source_url, as_of, status, reviewed_by, reviewed_at, notes) values\n${rows.join(",\n")};\n` : ""
}${END}`;
const seedPath = path.join(root, "supabase/seed.sql");
const seed = readFileSync(seedPath, "utf8");
const start = seed.indexOf(BEGIN);
const end = seed.indexOf(END);
writeFileSync(seedPath, start === -1 ? `${seed.trimEnd()}\n\n${block}\n` : `${seed.slice(0, start)}${block}${seed.slice(end + END.length)}`);
console.log(`wrote ${rows.length} duty preset(s) to supabase/seed.sql`);
