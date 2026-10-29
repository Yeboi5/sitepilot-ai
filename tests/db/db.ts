import { Pool, type PoolClient } from "pg";

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/sitepilot_test";

const pool = new Pool({ connectionString: TEST_DATABASE_URL, max: 4 });

export async function closePool() {
  await pool.end();
}

/**
 * Switch the current transaction to act as a Supabase end user (or anon when null).
 * Like a real sign-in, this creates a live auth.sessions row and puts its id in the JWT;
 * returns the session id so tests can revoke it.
 */
export async function actAs(
  client: PoolClient,
  authId: string | null,
  opts: { sessionId?: string | null } = {},
): Promise<string | null> {
  await client.query("reset role");
  if (authId === null) {
    await client.query("select set_config('request.jwt.claims', '', true)");
    await client.query("set local role anon");
    return null;
  }
  let sessionId = opts.sessionId;
  if (sessionId === undefined) {
    const { rows } = await client.query<{ id: string }>("insert into auth.sessions (user_id) values ($1) returning id", [authId]);
    sessionId = rows[0]!.id;
  }
  const claims = JSON.stringify({ sub: authId, role: "authenticated", ...(sessionId ? { session_id: sessionId } : {}) });
  await client.query("select set_config('request.jwt.claims', $1, true)", [claims]);
  await client.query("set local role authenticated");
  return sessionId;
}

/** Run SQL as the database owner (e.g. to simulate Supabase Auth deleting a session). */
export async function asOwner(client: PoolClient, sql: string, params: unknown[] = []) {
  await client.query("reset role");
  return client.query(sql, params);
}

/** Run `fn` inside a transaction that is always rolled back, so tests never leak state. */
export async function inTx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    return await fn(client);
  } finally {
    await client.query("rollback").catch(() => undefined);
    client.release();
  }
}

/** Convenience: run a whole transaction as one user. */
export function as<T>(authId: string | null, fn: (client: PoolClient) => Promise<T>) {
  return inTx(async (client) => {
    await actAs(client, authId);
    return fn(client);
  });
}

export async function ids(client: PoolClient, sql: string, params: unknown[] = []) {
  const { rows } = await client.query<{ id: string }>(sql, params);
  return rows.map((r) => r.id).sort();
}
