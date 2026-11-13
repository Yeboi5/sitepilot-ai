import { createHmac, timingSafeEqual } from "node:crypto";

/** Compact signed token: base64url(payload).base64url(hmac-sha256). */
export interface SessionPayload {
  uid: string;
  exp: number; // epoch seconds
}

export function signSession(payload: SessionPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySession(token: string | undefined, secret: string, now = Date.now()): SessionPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret).update(body).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    if (typeof p.uid !== "string" || typeof p.exp !== "number" || p.exp * 1000 < now) return null;
    return p;
  } catch {
    return null;
  }
}
