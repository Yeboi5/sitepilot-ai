import { createHash } from "node:crypto";

/** Share links carry a random token; only its SHA-256 is stored (shared_vision looks it up). */
export const hashShareToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Tokens are 24 random bytes in base64url (32 characters). */
export const isShareToken = (token: string) => /^[A-Za-z0-9_-]{32}$/.test(token);
