import type { Recurrence } from "./types";

/**
 * Modular category registry. Every savings category shares the same requests,
 * offers, negotiations and transactions; only fields, comparison rules and
 * negotiation guidance differ. Add a category by adding a definition here
 * (and, in production, a row in the `categories` table).
 */
export type FieldType = "text" | "number" | "select" | "boolean";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  unit?: string;
  options?: string[];
  help?: string;
}

export interface ComparisonWeights {
  price: number;
  warranty: number;
  completion: number;
  credentials: number;
  reviews: number;
}

export interface CategoryDefinition {
  id: string;
  name: string;
  group: "home" | "utilities" | "telco" | "finance" | "vehicle" | "retail" | "lifestyle" | "services" | "other";
  icon: string;
  description: string;
  defaultRecurrence: Recurrence;
  fields: FieldDef[];
  weights: ComparisonWeights;
  /** Offers lacking these are flagged in comparisons. */
  requiresLicence: boolean;
  requiresInsurance: boolean;
  /** Label for "completion time" in this category. */
  completionLabel: string;
  /** SIMULATED benchmark range used by the mock analyser, as fraction of the stated price. */
  simulatedBenchmark: { low: number; high: number };
  negotiationLevers: string[];
  /** Regulatory or consumer-protection notes shown to customers. */
  notes?: string;
}

const W = (price: number, warranty: number, completion: number, credentials: number, reviews: number): ComparisonWeights => ({
  price, warranty, completion, credentials, reviews,
});

export const CATEGORIES: CategoryDefinition[] = [
  {
    id: "trades",
    name: "Trades & home improvements",
    group: "home",
    icon: "Hammer",
    description: "Fencing, roofing, plumbing, electrical, landscaping, renovations.",
    defaultRecurrence: "one_off",
    fields: [
      { key: "trade", label: "Trade", type: "select", required: true, options: ["Fencing", "Roofing", "Plumbing", "Electrical", "Landscaping", "Painting", "Carpentry", "Other"] },
      { key: "size", label: "Size / quantity", type: "number", unit: "m or m²" },
      { key: "material", label: "Preferred material", type: "text" },
      { key: "removal", label: "Remove existing structure", type: "boolean" },
      { key: "access", label: "Site access notes", type: "text" },
    ],
    weights: W(0.45, 0.2, 0.1, 0.15, 0.1),
    requiresLicence: true,
    requiresInsurance: true,
    completionLabel: "Completion time",
    simulatedBenchmark: { low: 0.8, high: 0.95 },
    negotiationLevers: ["Competing written quotes", "Flexible start date", "Material alternatives", "Pay on completion milestones"],
    notes: "Check the trade licence with your state regulator and confirm public liability insurance before work starts.",
  },
  {
    id: "energy",
    name: "Electricity & gas",
    group: "utilities",
    icon: "Zap",
    description: "Retail electricity, gas and solar plans.",
    defaultRecurrence: "monthly",
    fields: [
      { key: "fuel", label: "Fuel", type: "select", required: true, options: ["Electricity", "Gas", "Dual fuel"] },
      { key: "usage", label: "Usage per month", type: "number", unit: "kWh/MJ" },
      { key: "solar", label: "Has solar", type: "boolean" },
      { key: "postcode", label: "Postcode", type: "text", required: true },
    ],
    weights: W(0.7, 0, 0, 0.1, 0.2),
    requiresLicence: false,
    requiresInsurance: false,
    completionLabel: "Switch time",
    simulatedBenchmark: { low: 0.78, high: 0.92 },
    negotiationLevers: ["Reference price comparison", "Pay-on-time discounts", "Loyalty tax removal", "Competitor offer matching"],
    notes: "Compare using the reference price and the government comparison site for your state.",
  },
  {
    id: "telco",
    name: "Internet & mobile",
    group: "telco",
    icon: "Wifi",
    description: "NBN/home broadband and mobile plans.",
    defaultRecurrence: "monthly",
    fields: [
      { key: "service", label: "Service", type: "select", required: true, options: ["Home internet", "Mobile", "Bundle"] },
      { key: "speed", label: "Speed tier / data", type: "text" },
      { key: "contract", label: "Contract term", type: "select", options: ["No contract", "12 months", "24 months"] },
      { key: "tenureYears", label: "Years with provider", type: "number" },
    ],
    weights: W(0.65, 0, 0.05, 0.05, 0.25),
    requiresLicence: false,
    requiresInsurance: false,
    completionLabel: "Activation time",
    simulatedBenchmark: { low: 0.7, high: 0.85 },
    negotiationLevers: ["Loyalty / retention offer", "Competitor introductory price", "Plan right-sizing", "Remove unused add-ons"],
  },
  {
    id: "insurance",
    name: "Insurance",
    group: "finance",
    icon: "Shield",
    description: "Home, contents, car, health, pet and travel insurance.",
    defaultRecurrence: "annual",
    fields: [
      { key: "type", label: "Insurance type", type: "select", required: true, options: ["Home", "Contents", "Car", "Health", "Pet", "Travel"] },
      { key: "sumInsured", label: "Sum insured", type: "number", unit: "AUD" },
      { key: "excess", label: "Excess", type: "number", unit: "AUD" },
    ],
    weights: W(0.5, 0, 0, 0.25, 0.25),
    requiresLicence: true,
    requiresInsurance: false,
    completionLabel: "Policy start",
    simulatedBenchmark: { low: 0.82, high: 0.95 },
    negotiationLevers: ["Last year's premium comparison", "Higher excess", "Multi-policy discount", "Competing quote"],
    notes: "DealPilot gives general information, not personal financial advice. Read the PDS and compare cover, not just price.",
  },
  {
    id: "vehicle",
    name: "Vehicle servicing & repairs",
    group: "vehicle",
    icon: "Car",
    description: "Logbook servicing, repairs, tyres, panel work.",
    defaultRecurrence: "one_off",
    fields: [
      { key: "make", label: "Make & model", type: "text", required: true },
      { key: "year", label: "Year", type: "number" },
      { key: "work", label: "Work required", type: "text", required: true },
      { key: "odometer", label: "Odometer", type: "number", unit: "km" },
    ],
    weights: W(0.5, 0.2, 0.15, 0.1, 0.05),
    requiresLicence: true,
    requiresInsurance: true,
    completionLabel: "Turnaround",
    simulatedBenchmark: { low: 0.8, high: 0.93 },
    negotiationLevers: ["Itemised parts vs labour", "Aftermarket vs genuine parts", "Competing quotes"],
  },
  {
    id: "retail",
    name: "Retail products & electronics",
    group: "retail",
    icon: "ShoppingBag",
    description: "Appliances, electronics, furniture and other goods.",
    defaultRecurrence: "one_off",
    fields: [
      { key: "product", label: "Product / model", type: "text", required: true },
      { key: "condition", label: "Condition", type: "select", options: ["New", "Refurbished", "Either"] },
      { key: "delivery", label: "Delivery required", type: "boolean" },
    ],
    weights: W(0.65, 0.2, 0.15, 0, 0),
    requiresLicence: false,
    requiresInsurance: false,
    completionLabel: "Delivery time",
    simulatedBenchmark: { low: 0.85, high: 0.97 },
    negotiationLevers: ["Price-match policy", "Bundle accessories", "Floor stock / open box", "Extended warranty included"],
  },
  {
    id: "subscriptions",
    name: "Subscriptions",
    group: "lifestyle",
    icon: "Repeat",
    description: "Streaming, software, gym, memberships.",
    defaultRecurrence: "monthly",
    fields: [{ key: "service", label: "Service", type: "text", required: true }, { key: "seats", label: "Seats / profiles", type: "number" }],
    weights: W(0.8, 0, 0, 0, 0.2),
    requiresLicence: false,
    requiresInsurance: false,
    completionLabel: "Start",
    simulatedBenchmark: { low: 0.6, high: 0.9 },
    negotiationLevers: ["Annual billing discount", "Downgrade tier", "Cancel and retention offer"],
  },
  {
    id: "cleaning",
    name: "Cleaning & household services",
    group: "services",
    icon: "Sparkles",
    description: "Home cleaning, end-of-lease, carpet, pest control, gardening.",
    defaultRecurrence: "one_off",
    fields: [
      { key: "service", label: "Service", type: "select", required: true, options: ["Regular clean", "End of lease", "Carpet", "Pest control", "Gardening"] },
      { key: "bedrooms", label: "Bedrooms", type: "number" },
      { key: "frequency", label: "Frequency", type: "select", options: ["Once", "Weekly", "Fortnightly", "Monthly"] },
    ],
    weights: W(0.5, 0.1, 0.1, 0.1, 0.2),
    requiresLicence: false,
    requiresInsurance: true,
    completionLabel: "Availability",
    simulatedBenchmark: { low: 0.8, high: 0.95 },
    negotiationLevers: ["Recurring booking discount", "Off-peak timing", "Bundle services"],
  },
  {
    id: "moving",
    name: "Moving & logistics",
    group: "services",
    icon: "Truck",
    description: "Removalists, storage, freight and courier.",
    defaultRecurrence: "one_off",
    fields: [
      { key: "from", label: "From suburb", type: "text", required: true },
      { key: "to", label: "To suburb", type: "text", required: true },
      { key: "volume", label: "Volume / bedrooms", type: "text" },
      { key: "date", label: "Preferred date", type: "text" },
    ],
    weights: W(0.5, 0.05, 0.15, 0.15, 0.15),
    requiresLicence: false,
    requiresInsurance: true,
    completionLabel: "Earliest date",
    simulatedBenchmark: { low: 0.78, high: 0.93 },
    negotiationLevers: ["Flexible date", "Mid-week move", "Back-loading", "Fixed-price vs hourly"],
  },
  {
    id: "custom",
    name: "Other / custom request",
    group: "other",
    icon: "Package",
    description: "Anything else you want to buy or reprice.",
    defaultRecurrence: "one_off",
    fields: [{ key: "details", label: "Details", type: "text", required: true }],
    weights: W(0.6, 0.15, 0.1, 0.1, 0.05),
    requiresLicence: false,
    requiresInsurance: false,
    completionLabel: "Completion time",
    simulatedBenchmark: { low: 0.85, high: 0.95 },
    negotiationLevers: ["Competing quotes", "Bundle", "Payment timing"],
  },
];

const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

export function getCategory(id: string): CategoryDefinition {
  const c = BY_ID.get(id);
  if (!c) throw new Error(`Unknown category: ${id}`);
  return c;
}

export function isCategory(id: string): boolean {
  return BY_ID.has(id);
}

/** Validates and coerces category-specific fields from form input. */
export function validateCategoryFields(
  categoryId: string,
  input: Record<string, unknown>,
): { ok: true; fields: Record<string, string | number | boolean> } | { ok: false; errors: Record<string, string> } {
  const category = getCategory(categoryId);
  const fields: Record<string, string | number | boolean> = {};
  const errors: Record<string, string> = {};
  for (const def of category.fields) {
    const raw = input[def.key];
    const empty = raw === undefined || raw === null || raw === "";
    if (def.type === "boolean") {
      fields[def.key] = raw === true || raw === "on" || raw === "true";
      continue;
    }
    if (empty) {
      if (def.required) errors[def.key] = `${def.label} is required`;
      continue;
    }
    const str = String(raw).trim().slice(0, 500);
    if (def.type === "number") {
      const n = Number(str);
      if (!Number.isFinite(n) || n < 0) errors[def.key] = `${def.label} must be a positive number`;
      else fields[def.key] = n;
    } else if (def.type === "select") {
      if (def.options && !def.options.includes(str)) errors[def.key] = `${def.label} has an invalid option`;
      else fields[def.key] = str;
    } else {
      fields[def.key] = str;
    }
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, fields };
}
