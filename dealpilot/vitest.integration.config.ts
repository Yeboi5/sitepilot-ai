import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Integration tests against a running local Supabase stack (`npx supabase start`).
 * The global setup resets the database (migrations + demo seed) before the run.
 */
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src"), "server-only": path.resolve(__dirname, "tests/server-only-stub.ts") } },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    globalSetup: ["tests/integration/global-setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});
