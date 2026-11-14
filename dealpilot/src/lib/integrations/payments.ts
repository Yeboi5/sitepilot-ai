import type { Cents } from "../domain/money";

/**
 * Payment collection for assessed success fees. Phase 2 product decision: real charges are NOT
 * enabled. The only provider is "disabled", which records nothing as collected. A real provider
 * (e.g. Stripe) must be added explicitly AND switched on with PAYMENTS_LIVE_APPROVED=true after
 * written approval, legal review of fee disclosure, and testing in the provider's test mode.
 */
export interface FeeCollectionRequest {
  transactionId: string;
  customerId: string;
  amountCents: Cents;
  currency: string;
  /** Same key as the ledger's fee entry, so a retry can never collect twice. */
  idempotencyKey: string;
}

export type FeeCollectionResult =
  | { status: "collected"; providerReference: string }
  | { status: "not_collected"; reason: string };

export interface PaymentProvider {
  readonly name: string;
  readonly live: boolean;
  collectFee(req: FeeCollectionRequest): Promise<FeeCollectionResult>;
}

export const disabledPayments: PaymentProvider = {
  name: "disabled",
  live: false,
  async collectFee() {
    return { status: "not_collected", reason: "Payments are not enabled. The fee is assessed and recorded only." };
  },
};

export function paymentProvider(): PaymentProvider {
  if (process.env.PAYMENTS_PROVIDER && process.env.PAYMENTS_PROVIDER !== "none") {
    // Deliberately not implemented in Phase 2. Fail loudly rather than silently not charging.
    throw new Error(`Payment provider "${process.env.PAYMENTS_PROVIDER}" is not implemented. Real charges require explicit approval.`);
  }
  return disabledPayments;
}
