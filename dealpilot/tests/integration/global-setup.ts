import { execSync } from "node:child_process";

/** Resets the local Supabase database to migrations + demo seed, and exports its connection details. */
export default function setup() {
  const env = execSync("npx supabase status -o env", { encoding: "utf8" });
  const get = (k: string) => env.match(new RegExp(`^${k}="?([^"\\n]+)"?`, "m"))?.[1];
  const api = get("API_URL");
  if (!api) throw new Error("Local Supabase is not running. Start it with: npx supabase start");
  if (process.env.SKIP_DB_RESET !== "1") execSync("npx supabase db reset", { stdio: "ignore" });
  process.env.NEXT_PUBLIC_SUPABASE_URL = api;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = get("ANON_KEY");
  process.env.SUPABASE_SERVICE_ROLE_KEY = get("SERVICE_ROLE_KEY");
  process.env.MAILPIT_URL = get("MAILPIT_URL") ?? "http://127.0.0.1:54324";
  process.env.DB_URL = get("DB_URL");
}
