import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Row, Store, TableName } from "./types";

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
  for (const [k, v] of Object.entries(row)) if (v !== undefined && k !== "passwordHash") out[toSnake(k)] = v;
  return out;
}

export function rowFromDb<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) if (v !== null) out[toCamel(k)] = v;
  return out as T;
}

/**
 * Production driver. Uses the service-role key server-side; authorisation is
 * enforced by the service layer (src/lib/services) and RLS policies protect
 * any direct client access with the anon key. Documents go to the private
 * `documents` Storage bucket.
 */
export class SupabaseStore implements Store {
  private db: SupabaseClient;
  constructor(url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY) {
    if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for DATA_DRIVER=supabase");
    this.db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  async get<T extends TableName>(table: T, id: string) {
    const { data, error } = await this.db.from(TABLE_MAP[table]).select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? rowFromDb<Row<T>>(data) : undefined;
  }

  async list<T extends TableName>(table: T, where?: Partial<Row<T>>) {
    let q = this.db.from(TABLE_MAP[table]).select("*");
    for (const [k, v] of Object.entries(where ?? {})) q = q.eq(toSnake(k), v as never);
    const { data, error } = await q.limit(1000);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => rowFromDb<Row<T>>(r));
  }

  async insert<T extends TableName>(table: T, row: Row<T>) {
    const { data, error } = await this.db.from(TABLE_MAP[table]).insert(rowToDb(row as unknown as Record<string, unknown>)).select("*").single();
    if (error) throw new Error(error.message);
    return rowFromDb<Row<T>>(data);
  }

  async update<T extends TableName>(table: T, id: string, patch: Partial<Row<T>>) {
    const { data, error } = await this.db.from(TABLE_MAP[table]).update(rowToDb(patch as Record<string, unknown>)).eq("id", id).select("*").single();
    if (error) throw new Error(error.message);
    return rowFromDb<Row<T>>(data);
  }

  async putBlob(key: string, data: Uint8Array, mimeType: string) {
    const { error } = await this.db.storage.from("documents").upload(key, data, { contentType: mimeType, upsert: false });
    if (error) throw new Error(error.message);
  }

  async getBlob(key: string) {
    const { data, error } = await this.db.storage.from("documents").download(key);
    if (error || !data) return undefined;
    return { data: new Uint8Array(await data.arrayBuffer()), mimeType: data.type };
  }
}
