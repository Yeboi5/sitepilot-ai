import type { Cents } from "./money";

export type Role = "customer" | "business" | "admin";
export type PermissionMode = "advisory" | "approval" | "autopilot";
export type Recurrence = "one_off" | "weekly" | "monthly" | "quarterly" | "annual";
/** How real a piece of data or functionality is. Shown in the UI everywhere it matters. */
export type Provenance = "live" | "simulated" | "future";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  businessId?: string;
  /** scrypt hash, demo driver only. Supabase driver uses Supabase Auth. */
  passwordHash?: string;
  permissionMode: PermissionMode;
  /** Limited Autopilot: max committed amount per action. 0 disables autopilot actions. */
  autopilotLimitCents: Cents;
  region: string;
  isDemo: boolean;
  createdAt: string;
}

export interface Business {
  id: string;
  /** Absent for simulated providers that no person operates. */
  ownerId?: string;
  name: string;
  abn?: string;
  description: string;
  categories: string[];
  regions: string[];
  qualifications: string[];
  licenceNumber?: string;
  insured: boolean;
  rating?: number;
  reviewCount: number;
  /** Reviews are only shown to customers when verified against completed transactions. */
  reviewsVerified: boolean;
  /** Fictional business used only for demonstrations. */
  isSimulated: boolean;
  createdAt: string;
}

export interface LineItem {
  description: string;
  amountCents: Cents;
}

export interface DocumentAnalysis {
  provider: string;
  /** True when produced by the mock provider or using simulated benchmarks. */
  simulated: boolean;
  vendor?: string;
  totalCents?: Cents;
  recurrence?: Recurrence;
  lineItems: LineItem[];
  keyTerms: string[];
  risks: string[];
  benchmarkLowCents?: Cents;
  benchmarkHighCents?: Cents;
  suggestedTargetCents?: Cents;
  summary: string;
  createdAt: string;
}

export interface StoredDocument {
  id: string;
  ownerId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  categoryId: string;
  kind: "quote" | "bill" | "receipt" | "contract" | "invoice" | "statement" | "other";
  storageKey: string;
  analysis?: DocumentAnalysis;
  isDemo: boolean;
  uploadedAt: string;
}

export type RequestStatus = "open" | "negotiating" | "awarded" | "completed" | "cancelled";

export interface PurchaseRequest {
  id: string;
  customerId: string;
  categoryId: string;
  title: string;
  description: string;
  region: string;
  fields: Record<string, string | number | boolean>;
  /** The customer's existing quote or bill (per recurrence period). */
  baselineCents: Cents;
  recurrence: Recurrence;
  documentId?: string;
  status: RequestStatus;
  closesAt: string;
  isDemo: boolean;
  createdAt: string;
}

export type OfferStatus = "draft" | "submitted" | "countered" | "accepted" | "declined" | "withdrawn" | "expired";

export interface Offer {
  id: string;
  requestId: string;
  businessId: string;
  status: OfferStatus;
  priceCents: Cents;
  recurrence: Recurrence;
  scope: string;
  materials: string;
  warrantyMonths: number;
  completionDays: number;
  includesInsurance: boolean;
  aiDrafted: boolean;
  /** A real person at the business must approve before a bid is visible to customers. */
  approvedByUserId?: string;
  approvedAt?: string;
  validUntil: string;
  isSimulated: boolean;
  createdAt: string;
  updatedAt: string;
}

export type NegotiationState =
  | "open"
  | "awaiting_approval"
  | "awaiting_counterparty"
  | "counter_received"
  | "escalated"
  | "agreed"
  | "completed"
  | "declined"
  | "cancelled"
  | "expired";

export type MessageAuthor = "customer" | "ai" | "business" | "system";
export type MessageKind = "analysis" | "draft" | "sent" | "counter" | "note" | "escalation" | "decision";

export interface NegotiationMessage {
  id: string;
  at: string;
  from: MessageAuthor;
  kind: MessageKind;
  body: string;
  amountCents?: Cents;
  /** Draft awaiting explicit customer confirmation (Approval mode). */
  pendingApproval?: boolean;
  approvedAt?: string;
  simulated?: boolean;
}

export interface Negotiation {
  id: string;
  customerId: string;
  categoryId: string;
  title: string;
  requestId?: string;
  offerId?: string;
  businessId?: string;
  counterpartyName: string;
  mode: PermissionMode;
  state: NegotiationState;
  baselineCents: Cents;
  targetCents: Cents;
  /** Best price currently on the table from the counterparty. */
  currentOfferCents: Cents;
  agreedCents?: Cents;
  recurrence: Recurrence;
  messages: NegotiationMessage[];
  /** External counterparty is simulated (no authorised integration exists). */
  simulated: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PriceTier {
  minMembers: number;
  priceCents: Cents;
}

export interface GroupOffer {
  id: string;
  businessId: string;
  tiers: PriceTier[];
  terms: string;
  validUntil: string;
  approvedByUserId?: string;
  isSimulated: boolean;
  createdAt: string;
}

export interface PurchasingGroup {
  id: string;
  categoryId: string;
  title: string;
  description: string;
  region: string;
  eligibility: string;
  memberIds: string[];
  /** Demo-only placeholder members so group tiers can be shown. Always displayed as simulated. */
  simulatedMemberCount: number;
  targetSize: number;
  baselineCents: Cents;
  recurrence: Recurrence;
  expiresAt: string;
  offers: GroupOffer[];
  status: "forming" | "offer_available" | "closed";
  isSimulated: boolean;
  createdAt: string;
}

export type WatchKind = "retail_product" | "bill" | "subscription" | "contract";
export type DataSource = "manual" | "simulated_feed" | "approved_api";

export interface PricePoint {
  at: string;
  cents: Cents;
  source: DataSource;
}

export interface PriceWatch {
  id: string;
  userId: string;
  kind: WatchKind;
  label: string;
  merchant: string;
  categoryId: string;
  purchasePriceCents: Cents;
  purchasedAt?: string;
  targetPriceCents?: Cents;
  /** Retailer price-adjustment window (customer must confirm the actual policy). */
  adjustmentWindowDays?: number;
  renewalDate?: string;
  history: PricePoint[];
  dataSource: DataSource;
  active: boolean;
  createdAt: string;
}

export interface Alert {
  id: string;
  userId: string;
  watchId?: string;
  kind: "price_drop" | "target_reached" | "adjustment_eligible" | "bill_increase" | "renewal_due" | "alternative_offer" | "guardian" | "offer" | "negotiation";
  title: string;
  body: string;
  potentialSavingsCents?: Cents;
  href?: string;
  read: boolean;
  createdAt: string;
}

export interface ExpenseLine {
  id: string;
  userId: string;
  date: string;
  merchant: string;
  amountCents: Cents;
  source: "manual" | "csv_upload" | "read_only_feed";
  createdAt: string;
}

export type TransactionStatus = "pending_verification" | "verified" | "rejected" | "cancelled";
export type VerificationMethod = "customer_confirmed_invoice" | "business_confirmed" | "document_match" | "admin_review";

export interface Transaction {
  id: string;
  customerId: string;
  businessId?: string;
  categoryId: string;
  description: string;
  requestId?: string;
  offerId?: string;
  negotiationId?: string;
  groupId?: string;
  baselineCents: Cents;
  finalCents: Cents;
  recurrence: Recurrence;
  /** Saving per period (baseline - final). */
  periodSavingsCents: Cents;
  /** First-12-months saving; equals periodSavings for one-off purchases. */
  annualSavingsCents: Cents;
  status: TransactionStatus;
  verificationMethod?: VerificationMethod;
  evidenceDocumentId?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  feeCents: Cents;
  feeStatus: "not_applicable" | "pending" | "charged_simulated" | "waived";
  simulated: boolean;
  createdAt: string;
}

export type LedgerEntryType = "saving_recorded" | "saving_verified" | "fee_charged" | "fee_waived" | "commission_recorded";

export interface LedgerEntry {
  id: string;
  transactionId: string;
  userId: string;
  type: LedgerEntryType;
  amountCents: Cents;
  currency: string;
  idempotencyKey: string;
  simulated: boolean;
  note?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  at: string;
  actorId: string;
  actorRole: Role | "system";
  action: string;
  entityType: string;
  entityId: string;
  detail?: Record<string, unknown>;
}

export interface Actor {
  userId: string;
  role: Role;
  businessId?: string;
}
