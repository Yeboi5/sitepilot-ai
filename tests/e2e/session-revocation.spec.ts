import { expect, test } from "@playwright/test";
import { ACCOUNTS, PASSWORD } from "./helpers";

// API-level check against the real Supabase Auth + PostgREST: a token captured before sign-out
// must stop working the moment the session ends (see migration 20261029020000).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

test.skip(!supabaseUrl || !anonKey, "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY not set");

test("an access token stops working against the data API after sign-out", async ({ request }) => {
  const headers = { apikey: anonKey!, "Content-Type": "application/json" };
  const login = await request.post(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    headers,
    data: { email: ACCOUNTS.ivy, password: PASSWORD },
  });
  expect(login.ok()).toBe(true);
  const { access_token: token } = (await login.json()) as { access_token: string };
  const authed = { ...headers, Authorization: `Bearer ${token}` };

  const before = await request.get(`${supabaseUrl}/rest/v1/properties?select=id`, { headers: authed });
  expect(((await before.json()) as unknown[]).length).toBeGreaterThan(0);

  const logout = await request.post(`${supabaseUrl}/auth/v1/logout`, { headers: authed });
  expect(logout.status()).toBe(204);

  const after = await request.get(`${supabaseUrl}/rest/v1/properties?select=id`, { headers: authed });
  expect(await after.json()).toEqual([]);
});
