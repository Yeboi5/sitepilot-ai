import { defineConfig, devices } from "@playwright/test";

// End-to-end tests against a running local stack (`npx supabase start` + seeded demo data).
// See README → Testing → End-to-end.
try {
  process.loadEnvFile(".env.local"); // Supabase URL + anon key for API-level checks
} catch {
  // optional: variables may come from the environment instead
}

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npm run build && npm run start", url: baseURL, timeout: 240_000, reuseExistingServer: true },
});
