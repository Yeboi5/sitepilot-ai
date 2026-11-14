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
  return { successFeeCents: int("SUCCESS_FEE_CENTS", 150), currency: process.env.FEE_CURRENCY || market().currency };
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

/** Authentication follows the data driver: Supabase Auth for real data, signed cookies for the memory demo. */
export function authDriver(): "supabase" | "demo" {
  return dataDriver() === "supabase" ? "supabase" : "demo";
}

/**
 * Demonstration environment: one-click demo sign-in and simulation controls are available.
 * Always true for the memory driver; for Supabase only when DEMO_MODE=true (staging demo projects).
 */
export function demoMode(): boolean {
  return dataDriver() === "memory" || process.env.DEMO_MODE === "true";
}

/** Roles that must enrol MFA before using the app (Supabase driver). Default: admin. */
export function mfaRequiredRoles(): string[] {
  return (process.env.MFA_REQUIRED_ROLES ?? "admin").split(",").map((s) => s.trim()).filter(Boolean);
}

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export interface MarketConfig {
  code: string;
  currency: string;
  locale: string;
  /** Sales tax rate applied to provider prices quoted ex-tax (e.g. GST). */
  salesTaxRate: number;
  salesTaxName: string;
  consumerRegulator: string;
  privacyRegime: string;
}

const MARKETS: Record<string, MarketConfig> = {
  AU: { code: "AU", currency: "AUD", locale: "en-AU", salesTaxRate: 0.1, salesTaxName: "GST", consumerRegulator: "ACCC and state fair trading offices", privacyRegime: "Privacy Act 1988 (Australian Privacy Principles)" },
  NZ: { code: "NZ", currency: "NZD", locale: "en-NZ", salesTaxRate: 0.15, salesTaxName: "GST", consumerRegulator: "Commerce Commission", privacyRegime: "Privacy Act 2020" },
  GB: { code: "GB", currency: "GBP", locale: "en-GB", salesTaxRate: 0.2, salesTaxName: "VAT", consumerRegulator: "CMA and Trading Standards", privacyRegime: "UK GDPR" },
};

/** Market is configurable; Australia is the launch market. */
export function market(): MarketConfig {
  const m = MARKETS[(process.env.MARKET ?? "AU").toUpperCase()];
  if (!m) throw new Error(`Unsupported MARKET ${process.env.MARKET}`);
  return m;
}
