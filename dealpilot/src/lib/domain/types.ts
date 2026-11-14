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
  /** Market the account belongs to (e.g. "AU"). Drives currency and regulatory notes. */
  jurisdiction?: string;
  currency?: string;
  /** Customer agreed to send documents to the configured AI provider. */
  aiProcessingConsent?: boolean;
  deletedAt?: string;
  isDemo: boolean;
  createdAt: string;
}

export type VerificationStatus = "unverified" | "pending" | "verified" | "suspended" | "rejected";
export type AbnStatus = "not_checked" | "checksum_valid" | "invalid" | "abr_active" | "abr_cancelled" | "abr_not_found" | "admin_confirmed";

export interface BusinessCredential {
  id: string;
  businessId: string;
  kind: "licence" | "insurance";
  reference: string;
  issuer: string;
  jurisdiction: string;
  expiresAt?: string;
  evidenceDocumentId?: string;
  status: "submitted" | "verified" | "rejected";
  checkMethod?: "admin_document_review" | "register_lookup";
  checkedBy?: string;
  checkedAt?: string;
  notes?: string;
  createdAt: string;
}

export interface Review {
  id: string;
  transactionId: string;
  businessId: string;
  customerId: string;
  rating: number;
  comment: string;
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
  /** Set only by an administrator after checks. Self-declared details never make a business verified. */
  verificationStatus: VerificationStatus;
  abnStatus?: AbnStatus;
  abnEntityName?: string;
  abnCheckedAt?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  statusReason?: string;
  jurisdiction?: string;
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
  kind: "quote" | "bill" | "receipt" | "contract" | "invoice" | "statement" | "certificate" | "other";
  storageKey: string;
  analysis?: DocumentAnalysis;
  scanStatus?: "not_scanned" | "clean" | "infected" | "error";
  scanEngine?: string;
  scannedAt?: string;
  /** Values the customer reviewed and corrected after AI extraction. These, not the raw AI output, are used downstream. */
  confirmed?: ConfirmedExtraction;
  confirmedAt?: string;
  isDemo: boolean;
  uploadedAt: string;
}

export interface ConfirmedExtraction {
  vendor?: string;
  totalCents?: Cents;
  recurrence: Recurrence;
  lineItems: LineItem[];
  notes?: string;
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
  | "final_approval"
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
  /** Final terms both parties must explicitly approve before a deal is agreed. */
  finalTerms?: FinalTerms;
  /** Set when the deal came from a purchasing group. */
  groupId?: string;
  /** Optimistic-concurrency version; every write must match and increment it. */
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface FinalTerms {
  priceCents: Cents;
  recurrence: Recurrence;
  scope?: string;
  warrantyMonths?: number;
  completionDays?: number;
  proposedBy: "customer" | "business";
  customerApprovedAt?: string;
  customerApprovedBy?: string;
  businessApprovedAt?: string;
  businessApprovedBy?: string;
  /** Who must approve on the business side: a real person, or a recorded exemption. */
  businessApproval: "required" | "simulated" | "not_applicable" | "pre_approved";
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
  /** assessed = owed but not collected (payments disabled). collected only via a payment provider. */
  feeStatus: "not_applicable" | "pending" | "not_qualifying" | "waived" | "assessed" | "collected" | "refunded" | "charged_simulated";
  qualifiesForFee?: boolean;
  feeReason?: string;
  currency?: string;
  jurisdiction?: string;
  simulated: boolean;
  createdAt: string;
}

export type LedgerEntryType = "saving_recorded" | "saving_verified" | "fee_assessed" | "fee_collected" | "fee_refunded" | "fee_waived" | "fee_charged" | "commission_recorded";

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

export interface NotificationLog {
  id: string;
  userId?: string;
  channel: "email" | "sms" | "push" | "in_app";
  template: string;
  status: "sent" | "failed" | "skipped";
  provider: string;
  error?: string;
  createdAt: string;
}

export interface Actor {
  userId: string;
  role: Role;
  businessId?: string;
}
