/**
 * Money is always stored and computed as integer cents. Never use floats for
 * stored amounts; convert only at the edges (parsing user input, formatting).
 */
export type Cents = number;

export function assertCents(value: number, label = "amount"): Cents {
  if (!Number.isInteger(value)) throw new Error(`${label} must be an integer number of cents`);
  if (!Number.isSafeInteger(value)) throw new Error(`${label} is out of range`);
  return value;
}

/** Parses "1,234.50", "$1234.5", "1234" into cents. Returns null when invalid. */
export function parseMoney(input: string | number | null | undefined): Cents | null {
  if (input === null || input === undefined) return null;
  const raw = typeof input === "number" ? input.toString() : input.replace(/[$,\sA-Za-z]/g, "");
  if (!/^-?\d+(\.\d{1,2})?$/.test(raw)) return null;
  const negative = raw.startsWith("-");
  const [whole, frac = ""] = raw.replace("-", "").split(".");
  const cents = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  if (!Number.isSafeInteger(cents)) return null;
  return negative ? -cents : cents;
}

export function formatMoney(cents: Cents, currency = "AUD", opts: { compact?: boolean } = {}): string {
  const value = cents / 100;
  const fractionDigits = opts.compact && Number.isInteger(value) ? 0 : 2;
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function percentOf(part: Cents, whole: Cents): number {
  if (whole === 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}
