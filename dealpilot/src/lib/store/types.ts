import type {
  Alert, AuditLog, Business, BusinessCredential, ExpenseLine, LedgerEntry, Negotiation, NotificationLog, Offer, PriceWatch,
  PurchaseRequest, PurchasingGroup, Review, StoredDocument, Transaction, User,
} from "../domain/types";

export interface Tables {
  users: User;
  businesses: Business;
  documents: StoredDocument;
  requests: PurchaseRequest;
  offers: Offer;
  negotiations: Negotiation;
  groups: PurchasingGroup;
  watches: PriceWatch;
  alerts: Alert;
  expenses: ExpenseLine;
  transactions: Transaction;
  ledger: LedgerEntry;
  audit: AuditLog;
  credentials: BusinessCredential;
  reviews: Review;
  notifications: NotificationLog;
}
export type TableName = keyof Tables;
export type Row<T extends TableName> = Tables[T];

/** Row lock + precondition checked inside an atomic batch. */
export type Guard = { table: TableName; id: string; field: string } & ({ equals: string | number | boolean } | { isNull: true });

export type BatchOp =
  | { op: "insert"; table: TableName; row: Record<string, unknown> }
  | { op: "update"; table: TableName; id: string; patch: Record<string, unknown> };

/**
 * Minimal persistence port. Services depend only on this interface, so the
 * memory driver (prototype) and Supabase driver (production) are swappable.
 */
export interface Store {
  get<T extends TableName>(table: T, id: string): Promise<Row<T> | undefined>;
  list<T extends TableName>(table: T, where?: Partial<Row<T>>): Promise<Row<T>[]>;
  insert<T extends TableName>(table: T, row: Row<T>): Promise<Row<T>>;
  update<T extends TableName>(table: T, id: string, patch: Partial<Row<T>>): Promise<Row<T>>;
  /** Private document blobs. */
  putBlob(key: string, data: Uint8Array, mimeType: string): Promise<void>;
  getBlob(key: string): Promise<{ data: Uint8Array; mimeType: string } | undefined>;
  deleteBlob(key: string): Promise<void>;
  /**
   * All-or-nothing write. Guards lock their rows and must all hold, otherwise nothing is written
   * and false is returned. Constraint violations throw and roll everything back.
   */
  atomic(guards: Guard[], ops: BatchOp[]): Promise<boolean>;
  /** Fixed-window rate limit shared by all app instances. Returns true when the call is allowed. */
  rateLimit(key: string, max: number, windowSeconds: number): Promise<boolean>;
}

/** Typed helpers so services build batch ops without casts. */
export const ins = <T extends TableName>(table: T, row: Row<T>): BatchOp => ({ op: "insert", table, row: row as unknown as Record<string, unknown> });
export const upd = <T extends TableName>(table: T, id: string, patch: Partial<Row<T>>): BatchOp => ({ op: "update", table, id, patch: patch as Record<string, unknown> });
