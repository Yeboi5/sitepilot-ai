import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Row, Store, TableName } from "./types";

import { rowFromDb, rowToDb, TABLE_MAP, toSnake } from "./supabase-mapping";

export { rowFromDb, rowToDb, TABLE_MAP };

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
