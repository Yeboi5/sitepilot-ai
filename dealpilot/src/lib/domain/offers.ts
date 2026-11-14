import type { CategoryDefinition } from "./categories";
import type { Business, BusinessCredential, Offer } from "./types";
import { credentialState, type CredentialState } from "./verification";

export interface ReviewStats { average: number; count: number }

/** Extra facts for ranking. Deliberately has no commission or payment fields: rankings must never depend on what a business pays DealPilot. */
export interface ComparisonContext {
  credentials?: Map<string, BusinessCredential[]>;
  reviews?: Map<string, ReviewStats>;
  now?: Date;
}

export interface OfferComparisonRow {
  offer: Offer;
  business: Business;
  score: number;
  flags: string[];
  best: { price: boolean; warranty: boolean; completion: boolean };
  /** Average rating from reviews of verified DealPilot jobs only. */
  verifiedRating?: number;
  reviewCount?: number;
  licence?: CredentialState;
  insurance?: CredentialState;
}

/** Offers visible to a customer: approved by a real business user (or a simulated demo provider), from a business that isn't suspended, and still live. */
export function isCustomerVisible(o: Offer, now = new Date(), business?: Business): boolean {
  if (o.status === "draft" || o.status === "withdrawn") return false;
  if (business && !o.isSimulated && business.verificationStatus === "suspended" && o.status !== "accepted") return false;
  if (!o.isSimulated && !o.approvedByUserId) return false;
  if (o.status === "submitted" && new Date(o.validUntil) < now) return false;
  return true;
}

const missingCredentials = (r: { flags: string[] }) => (r.flags.some((f) => f !== "Simulated demo offer") ? 1 : 0);

function norm(value: number, min: number, max: number, higherIsBetter: boolean): number {
  if (max === min) return 1;
  const x = (value - min) / (max - min);
  return higherIsBetter ? x : 1 - x;
}

/**
 * Multi-criteria comparison using the category's weights. The score helps
 * ranking; customers always see the raw figures and flags, never just a score.
 */
export function compareOffers(
  offers: Offer[],
  businesses: Map<string, Business>,
  category: CategoryDefinition,
  context: ComparisonContext = {},
): OfferComparisonRow[] {
  const now = context.now ?? new Date();
  const rows = offers.filter((o) => businesses.has(o.businessId));
  if (rows.length === 0) return [];
  const prices = rows.map((o) => o.priceCents);
  const warranties = rows.map((o) => o.warrantyMonths);
  const times = rows.map((o) => o.completionDays);
  const [pMin, pMax] = [Math.min(...prices), Math.max(...prices)];
  const [wMin, wMax] = [Math.min(...warranties), Math.max(...warranties)];
  const [tMin, tMax] = [Math.min(...times), Math.max(...times)];
  const w = category.weights;

  return rows
    .map((offer) => {
      const business = businesses.get(offer.businessId)!;
      const flags: string[] = [];
      let credentials = 1;
      let licence: CredentialState | undefined;
      let insurance: CredentialState | undefined;
      if (offer.isSimulated) {
        // Simulated providers have only self-declared demo details; say so.
        if (category.requiresLicence && !business.licenceNumber) { flags.push("No licence number provided"); credentials -= 0.5; }
        if (category.requiresInsurance && !(business.insured && offer.includesInsurance)) { flags.push("Insurance not confirmed"); credentials -= 0.5; }
        flags.push("Simulated demo offer");
      } else {
        const creds = context.credentials?.get(business.id) ?? [];
        licence = credentialState(creds, "licence", now).state;
        insurance = credentialState(creds, "insurance", now).state;
        const ok = (st: CredentialState) => st === "verified" || st === "expiring";
        if (category.requiresLicence && !ok(licence)) { flags.push(licence === "expired" ? "Licence expired" : "Licence not verified"); credentials -= 0.5; }
        if (category.requiresInsurance && (!ok(insurance) || !offer.includesInsurance)) { flags.push(insurance === "expired" ? "Insurance expired" : "Insurance not verified"); credentials -= 0.5; }
      }
      const stats = context.reviews?.get(business.id);
      const verifiedRating = stats && stats.count > 0 ? Math.round(stats.average * 10) / 10 : undefined;
      const reviews = verifiedRating !== undefined ? verifiedRating / 5 : 0.5;
      const score =
        w.price * norm(offer.priceCents, pMin, pMax, false) +
        w.warranty * norm(offer.warrantyMonths, wMin, wMax, true) +
        w.completion * norm(offer.completionDays, tMin, tMax, false) +
        w.credentials * Math.max(credentials, 0) +
        w.reviews * reviews;
      return {
        offer,
        business,
        flags,
        verifiedRating,
        reviewCount: stats?.count,
        licence,
        insurance,
        score: Math.round(score * 100),
        best: {
          price: offer.priceCents === pMin,
          warranty: offer.warrantyMonths === wMax && wMax > 0,
          completion: offer.completionDays === tMin,
        },
      };
    })
    // Offers missing a licence or insurance the category requires never outrank compliant ones.
    .sort((a, b) => missingCredentials(a) - missingCredentials(b) || b.score - a.score || a.offer.priceCents - b.offer.priceCents);
}
