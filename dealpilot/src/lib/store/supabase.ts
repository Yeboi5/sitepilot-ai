import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { BatchOp, Guard, Row, Store, TableName } from "./types";

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

  async atomic(guards: Guard[], ops: BatchOp[]) {
    const body = {
      guards: guards.map((g) => ({ ...g, table: TABLE_MAP[g.table], field: toSnake(g.field), ...("equals" in g ? { equals: String(g.equals) } : {}) })),
      ops: ops.map((o) => (o.op === "insert" ? { op: "insert", table: TABLE_MAP[o.table], row: rowToDb(o.row) } : { op: "update", table: TABLE_MAP[o.table], id: o.id, patch: rowToDb(o.patch) })),
    };
    const { data, error } = await this.db.rpc("apply_batch", body);
    if (error) throw new Error(error.message);
    return data === true;
  }

  async rateLimit(key: string, max: number, windowSeconds: number) {
    const { data, error } = await this.db.rpc("rate_limit_hit", { p_key: key, p_max: max, p_window_seconds: windowSeconds });
    if (error) throw new Error(error.message);
    return data === true;
  }

  async putBlob(key: string, data: Uint8Array, mimeType: string) {
    const { error } = await this.db.storage.from("documents").upload(key, data, { contentType: mimeType, upsert: false });
    if (error) throw new Error(error.message);
  }

  async deleteBlob(key: string) {
    const { error } = await this.db.storage.from("documents").remove([key]);
    if (error) throw new Error(error.message);
  }

  /** Blocks sign-in for a deleted account (the auth identity is kept so financial records stay linked). */
  async disableAuthUser(userId: string, anonymisedEmail: string) {
    const { error } = await this.db.auth.admin.updateUserById(userId, { email: anonymisedEmail, ban_duration: "876000h", user_metadata: {} });
    if (error) throw new Error(error.message);
  }

  async getBlob(key: string) {
    const { data, error } = await this.db.storage.from("documents").download(key);
    if (error || !data) return undefined;
    return { data: new Uint8Array(await data.arrayBuffer()), mimeType: data.type };
  }
}
