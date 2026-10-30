import { SCENARIOS } from "./assumptions";
import { ENGINE_VERSION, evaluate, type Metric } from "./engine";
import type { CompareProperty } from "./facts";
import { scoreProperty, SCORE_VERSION } from "./score";
import type { CompareState } from "./state";

/**
 * A redacted, frozen copy of a comparison for its share link: suburb-level location only (no
 * street address), listing-level facts, the user's assumptions and the computed figures. No notes,
 * documents, workspace evidence or account details.
 */
export type SnapshotProperty = {
  label: string;
  location: string;
  propertyType: string;
  notForSale: boolean;
  isDemo: boolean;
  bedrooms: number | null;
  bathrooms: number | null;
  landAreaSqm: number | null;
  priceLabel: string;
  figures: Record<string, Metric>;
  projections: Record<string, { endValue: number; netReturn: Metric }> | null;
  score: number | null;
  coverage: number;
};
export type Snapshot = { version: 1; engine: string; scoring: string; takenAt: string; mode: CompareState["mode"]; assumptions: CompareState["assumptions"]; weights: CompareState["weights"]; properties: SnapshotProperty[] };

export function buildSnapshot(properties: CompareProperty[], state: CompareState, takenAt = new Date().toISOString()): Snapshot {
  return {
    version: 1,
    engine: ENGINE_VERSION,
    scoring: SCORE_VERSION,
    takenAt,
    mode: state.mode,
    assumptions: state.assumptions,
    weights: state.weights,
    properties: properties.map(({ listing: l, facts }) => {
      const o = state.overrides[l.id] ?? {};
      const r = evaluate(facts, state.assumptions, o);
      const s = scoreProperty(facts, r, state.weights);
      const priceLabel = r.priceSource === "user" ? "Your hypothetical price" : r.priceSource === "estimate" ? "Estimated value" : r.priceSource === "listing" ? "Asking price" : "Unknown";
      return {
        label: l.headline,
        location: `${l.suburb} ${l.state} ${l.postcode}`,
        propertyType: l.property_type,
        notForSale: l.market === "off_market",
        isDemo: l.is_demo,
        bedrooms: l.bedrooms,
        bathrooms: l.bathrooms,
        landAreaSqm: l.land_area_sqm,
        priceLabel,
        figures: {
          price: r.price,
          grossYield: r.grossYield,
          netYield: r.netYield,
          cashRequired: r.cashRequired,
          annualRepayments: r.annualRepayments,
          cashFlowYear1: r.cashFlowYear1,
        },
        projections: r.projections
          ? Object.fromEntries(SCENARIOS.map((sc) => [sc, { endValue: r.projections![sc].endValue, netReturn: r.projections![sc].netReturn }]))
          : null,
        score: s.score,
        coverage: s.coverage,
      };
    }),
  };
}
