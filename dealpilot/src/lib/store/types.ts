import type {
  Alert, AuditLog, Business, ExpenseLine, LedgerEntry, Negotiation, Offer, PriceWatch,
  PurchaseRequest, PurchasingGroup, StoredDocument, Transaction, User,
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
}
export type TableName = keyof Tables;
export type Row<T extends TableName> = Tables[T];

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
}
