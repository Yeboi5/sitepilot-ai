import type { CategoryDefinition } from "../domain/categories";
import type { Cents } from "../domain/money";
import type { Business, DocumentAnalysis, Negotiation, PurchaseRequest } from "../domain/types";

export interface AnalyseDocumentInput {
  filename: string;
  mimeType: string;
  /** Raw bytes; providers decide what they can read (text, PDF, image). */
  data: Uint8Array;
  category: CategoryDefinition;
  /** Amount the customer typed in, used when the document can't be read. */
  statedAmountCents?: Cents;
}

export interface DraftMessageInput {
  negotiation: Negotiation;
  category: CategoryDefinition;
  intent: "opening" | "counter" | "accept" | "decline";
  /** Price decided by deterministic policy; the AI must not change it. */
  priceCents: Cents;
  customerName: string;
}

export interface DraftBidInput {
  request: PurchaseRequest;
  business: Business;
  category: CategoryDefinition;
  /** Lowest visible competing price, if the business may see it (never for sealed bids). */
  floorHintCents?: Cents;
}

export interface DraftBid {
  priceCents: Cents;
  scope: string;
  materials: string;
  warrantyMonths: number;
  completionDays: number;
  rationale: string;
}

export interface DraftCounterInput {
  negotiation: Negotiation;
  business: Business;
  requestedCents: Cents;
  minimumCents: Cents;
}

/**
 * AI service abstraction. Implementations run on the server only. Money
 * decisions (targets, accept/counter/escalate) are made by deterministic
 * domain policy; AI is used for extraction and drafting.
 */
export interface AIProvider {
  readonly name: string;
  readonly simulated: boolean;
  analyseDocument(input: AnalyseDocumentInput): Promise<DocumentAnalysis>;
  draftNegotiationMessage(input: DraftMessageInput): Promise<string>;
  draftBid(input: DraftBidInput): Promise<DraftBid>;
  draftBusinessCounter(input: DraftCounterInput): Promise<{ priceCents: Cents; message: string }>;
}
