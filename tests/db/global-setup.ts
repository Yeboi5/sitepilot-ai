import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { TEST_DATABASE_URL } from "./db";

const root = path.resolve(__dirname, "../..");

/** Recreate the test database: Supabase shim → migrations (in order) → synthetic seed. */
export default async function setup() {
  const url = new URL(TEST_DATABASE_URL);
  const dbName = url.pathname.slice(1);
  const adminUrl = new URL(TEST_DATABASE_URL);
  adminUrl.pathname = "/postgres";

  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  await admin.query(`drop database if exists "${dbName}" with (force)`);
  await admin.query(`create database "${dbName}"`);
  await admin.end();

  const migrationsDir = path.join(root, "supabase/migrations");
  const files = [
    path.join(root, "supabase/tests/supabase-shim.sql"),
    ...readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .map((f) => path.join(migrationsDir, f)),
    path.join(root, "supabase/seed.sql"),
  ];

  const db = new Client({ connectionString: TEST_DATABASE_URL });
  await db.connect();
  try {
    for (const file of files) {
      await db.query(readFileSync(file, "utf8"));
    }
  } finally {
    await db.end();
  }
}
