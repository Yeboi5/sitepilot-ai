import "server-only";
import type { FeeConfig } from "./domain/savings";

function int(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) throw new Error(`${name} must be a non-negative integer`);
  return n;
}

export function feeConfig(): FeeConfig {
  return { successFeeCents: int("SUCCESS_FEE_CENTS", 150), currency: process.env.FEE_CURRENCY || "AUD" };
}

export function dataDriver(): "memory" | "supabase" {
  return process.env.DATA_DRIVER === "supabase" ? "supabase" : "memory";
}

export function aiProviderName(): "mock" | "anthropic" {
  return process.env.AI_PROVIDER === "anthropic" && process.env.ANTHROPIC_API_KEY ? "anthropic" : "mock";
}

export function sessionSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production" && process.env.DEALPILOT_ALLOW_DEV_SECRET !== "1") {
    throw new Error("SESSION_SECRET (32+ chars) is required in production");
  }
  return "dev-only-insecure-session-secret-change-me";
}
