import { defineConfig } from "vitest/config";

// Database/RLS integration tests. Requires PostgreSQL (see README → Testing).
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/db/**/*.test.ts"],
    globalSetup: ["tests/db/global-setup.ts"],
    fileParallelism: false,
  },
});
