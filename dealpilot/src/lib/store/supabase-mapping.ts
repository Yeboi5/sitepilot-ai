import type { TableName } from "./types";

/** Logical table → Postgres table (see supabase/migrations). */
export const TABLE_MAP: Record<TableName, string> = {
  users: "profiles",
  businesses: "businesses",
  documents: "documents",
  requests: "purchase_requests",
  offers: "offers",
  negotiations: "negotiations",
  groups: "purchasing_groups",
  watches: "price_watches",
  alerts: "alerts",
  expenses: "expense_lines",
  transactions: "transactions",
  ledger: "ledger_entries",
  audit: "audit_logs",
};

export const toSnake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
export const toCamel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

export function rowToDb(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) if (v !== undefined) out[toSnake(k)] = v;
  return out;
}

export function rowFromDb<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) if (v !== null) out[toCamel(k)] = v;
  return out as T;
}

