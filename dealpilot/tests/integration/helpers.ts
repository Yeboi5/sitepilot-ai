import { createHmac, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { MockAIProvider } from "@/lib/ai/mock";
import type { Ctx } from "@/lib/services/context";
import { DEMO_PASSWORD } from "@/lib/store/seed";
import { SupabaseStore } from "@/lib/store/supabase";

export const env = () => ({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  service: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  mailpit: process.env.MAILPIT_URL!,
});

export function supabaseCtx(): Ctx {
  return { store: new SupabaseStore(env().url, env().service), ai: new MockAIProvider(), fees: { successFeeCents: 150, currency: "AUD" }, now: () => new Date() };
}

export const anonClient = () => createClient(env().url, env().anon, { auth: { persistSession: false, autoRefreshToken: false } });
export const adminClient = () => createClient(env().url, env().service, { auth: { persistSession: false, autoRefreshToken: false } });

/** A signed-in client acting as a real end user, with only the anon key + their JWT. */
export async function signedInAs(email: string, password = DEMO_PASSWORD): Promise<SupabaseClient> {
  const c = anonClient();
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}

export const uniqueEmail = (tag: string) => `${tag}-${randomUUID().slice(0, 8)}@example.test`;

/** RFC 6238 TOTP (SHA-1, 30 s, 6 digits) — what an authenticator app computes. */
export function totp(base32Secret: string, now = Date.now()): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of base32Secret.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 1000 / 30)));
  const h = createHmac("sha1", key).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  const code = ((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).toString();
  return code.padStart(6, "0");
}

/** Latest email to `to` captured by the local Mailpit SMTP server. */
export async function latestEmail(to: string): Promise<{ text: string; subject: string }> {
  for (let i = 0; i < 20; i++) {
    const r = await fetch(`${env().mailpit}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`);
    const list = (await r.json()) as { messages?: { ID: string }[] };
    const id = list.messages?.[0]?.ID;
    if (id) {
      const m = (await (await fetch(`${env().mailpit}/api/v1/message/${id}`)).json()) as { Text: string; Subject: string };
      return { text: m.Text, subject: m.Subject };
    }
    await new Promise((res) => setTimeout(res, 250));
  }
  throw new Error(`No email for ${to}`);
}
