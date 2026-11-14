import type { BatchOp, Guard, Row, Store, TableName, Tables } from "./types";

type Data = { [K in TableName]: Map<string, Tables[K]> };

const clone = <T>(v: T): T => structuredClone(v);

/**
 * In-process store for the prototype. Rows are deep-cloned on read and write
 * so callers can never mutate stored state by accident. Unique constraints
 * that matter for integrity (ledger idempotency) are enforced here as they
 * are in the SQL schema.
 */
export class MemoryStore implements Store {
  private data: Data;
  private blobs = new Map<string, { data: Uint8Array; mimeType: string }>();
  private limits = new Map<string, { start: number; hits: number }>();

  constructor() {
    this.data = {
      users: new Map(), businesses: new Map(), documents: new Map(), requests: new Map(), offers: new Map(),
      negotiations: new Map(), groups: new Map(), watches: new Map(), alerts: new Map(), expenses: new Map(),
      transactions: new Map(), ledger: new Map(), audit: new Map(), credentials: new Map(), reviews: new Map(), notifications: new Map(),
    };
  }

  async get<T extends TableName>(table: T, id: string) {
    const row = this.data[table].get(id) as Row<T> | undefined;
    return row ? clone(row) : undefined;
  }

  async list<T extends TableName>(table: T, where?: Partial<Row<T>>) {
    const rows = [...this.data[table].values()] as Row<T>[];
    const filtered = where
      ? rows.filter((r) => Object.entries(where).every(([k, v]) => (r as unknown as Record<string, unknown>)[k] === v))
      : rows;
    return filtered.map(clone);
  }

  async insert<T extends TableName>(table: T, row: Row<T>) {
    const id = (row as { id: string }).id;
    if (!id) throw new Error("Row id required");
    if (this.data[table].has(id)) throw new Error(`Duplicate id in ${table}`);
    this.checkUnique(table, row);
    (this.data[table] as Map<string, Row<T>>).set(id, clone(row));
    return clone(row);
  }

  async update<T extends TableName>(table: T, id: string, patch: Partial<Row<T>>) {
    const existing = this.data[table].get(id) as Row<T> | undefined;
    if (!existing) throw new Error(`${table} ${id} not found`);
    if (table === "ledger" || table === "audit") throw new Error(`${table} is append-only`);
    const next = { ...existing, ...clone(patch), id } as Row<T>;
    (this.data[table] as Map<string, Row<T>>).set(id, next);
    return clone(next);
  }

  /** Mirrors the unique constraints that protect money and reviews in the SQL schema. */
  private checkUnique<T extends TableName>(table: T, row: Row<T>) {
    const unique: Partial<Record<TableName, string>> = { ledger: "idempotencyKey", transactions: "negotiationId", reviews: "transactionId", users: "email" };
    const field = unique[table];
    if (!field) return;
    const value = (row as unknown as Record<string, unknown>)[field];
    if (value === undefined) return;
    for (const r of this.data[table].values()) {
      if ((r as unknown as Record<string, unknown>)[field] === value) throw new Error(`Duplicate ${table}.${field}${table === "ledger" ? " (ledger idempotency key)" : ""}`);
    }
  }

  /**
   * Atomic in the single-threaded sense: guards are checked and ops applied with no await in
   * between, so concurrent requests interleave only between whole batches. On any error the
   * previous state is restored.
   */
  async atomic(guards: Guard[], ops: BatchOp[]): Promise<boolean> {
    for (const g of guards) {
      const row = this.data[g.table].get(g.id) as Record<string, unknown> | undefined;
      if (!row) return false;
      const v = row[g.field];
      if ("equals" in g ? v !== g.equals : v !== undefined && v !== null) return false;
    }
    const snapshot = Object.fromEntries(Object.entries(this.data).map(([k, m]) => [k, new Map(m as Map<string, unknown>)])) as unknown as typeof this.data;
    try {
      for (const op of ops) {
        if (op.op === "insert") {
          const id = op.row.id as string;
          if (this.data[op.table].has(id)) throw new Error(`Duplicate id in ${op.table}`);
          this.checkUnique(op.table, op.row as never);
          (this.data[op.table] as Map<string, unknown>).set(id, clone(op.row));
        } else {
          if (op.table === "ledger" || op.table === "audit") throw new Error(`${op.table} is append-only`);
          const existing = this.data[op.table].get(op.id);
          if (!existing) throw new Error(`${op.table} ${op.id} not found`);
          (this.data[op.table] as Map<string, unknown>).set(op.id, { ...existing, ...clone(op.patch), id: op.id });
        }
      }
      return true;
    } catch (e) {
      this.data = snapshot;
      throw e;
    }
  }

  async rateLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
    const now = Date.now();
    const cur = this.limits.get(key);
    const next = !cur || now - cur.start > windowSeconds * 1000 ? { start: now, hits: 1 } : { start: cur.start, hits: cur.hits + 1 };
    this.limits.set(key, next);
    return next.hits <= max;
  }

  async putBlob(key: string, data: Uint8Array, mimeType: string) {
    this.blobs.set(key, { data: new Uint8Array(data), mimeType });
  }

  async getBlob(key: string) {
    const b = this.blobs.get(key);
    return b ? { data: new Uint8Array(b.data), mimeType: b.mimeType } : undefined;
  }
}
