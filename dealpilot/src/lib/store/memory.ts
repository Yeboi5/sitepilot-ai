import type { Row, Store, TableName, Tables } from "./types";

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

  constructor() {
    this.data = {
      users: new Map(), businesses: new Map(), documents: new Map(), requests: new Map(), offers: new Map(),
      negotiations: new Map(), groups: new Map(), watches: new Map(), alerts: new Map(), expenses: new Map(),
      transactions: new Map(), ledger: new Map(), audit: new Map(),
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
    if (table === "ledger") {
      const key = (row as Tables["ledger"]).idempotencyKey;
      for (const e of this.data.ledger.values()) if (e.idempotencyKey === key) throw new Error("Duplicate ledger idempotency key");
    }
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

  async putBlob(key: string, data: Uint8Array, mimeType: string) {
    this.blobs.set(key, { data: new Uint8Array(data), mimeType });
  }

  async getBlob(key: string) {
    const b = this.blobs.get(key);
    return b ? { data: new Uint8Array(b.data), mimeType: b.mimeType } : undefined;
  }
}
