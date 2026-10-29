import { describe, expect, it } from "vitest";
import { ALL_FIELDS, parseAssumptionsForm, parseNumber } from "./form";
import { EMPTY_ASSUMPTIONS } from "./assumptions";

function formWith(values: Record<string, string>) {
  const fd = new FormData();
  fd.set("strategy", "develop_and_sell");
  fd.set("land.basis", "purchase_price");
  fd.set("timeline.projectMonths", "12");
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

describe("parseNumber", () => {
  it.each([
    ["1,200,000", 1_200_000],
    ["$950000", 950_000],
    ["6.5%", 6.5],
    [" 42 ", 42],
    ["", 0],
    [".5", 0.5],
  ])("%s → %s", (raw, expected) => expect(parseNumber(raw)).toBe(expected));

  it.each(["abc", "1e9", "1.2.3", "12abc", "--1"])("rejects %s", (raw) => expect(parseNumber(raw)).toBeNull());
});

describe("parseAssumptionsForm", () => {
  it("builds nested assumptions from dotted field names", () => {
    const r = parseAssumptionsForm(formWith({ "land.amount": "1,000,000", "finance.interestRatePct": "6.5" }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.land).toEqual({ basis: "purchase_price", amount: 1_000_000 });
      expect(r.data.finance.interestRatePct).toBe(6.5);
      expect(r.data.hard.construction).toBe(0);
    }
  });

  it("reports non-numeric input against its field", () => {
    const r = parseAssumptionsForm(formWith({ "hard.construction": "lots" }));
    expect(r).toEqual({ ok: false, fieldErrors: { "hard.construction": ["Enter a number"] } });
  });

  it("reports schema violations against their field", () => {
    const r = parseAssumptionsForm(formWith({ "finance.landDebtPct": "120", "land.amount": "-5" }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.fieldErrors).sort()).toEqual(["finance.landDebtPct", "land.amount"]);
    }
  });

  it("rejects an unknown strategy", () => {
    const fd = formWith({});
    fd.set("strategy", "flip_it");
    const r = parseAssumptionsForm(fd);
    expect(r.ok).toBe(false);
  });

  it("defines a form field for every numeric assumption", () => {
    const numericPaths: string[] = [];
    const walk = (o: object, prefix: string) => {
      for (const [k, v] of Object.entries(o)) {
        const p = prefix ? `${prefix}.${k}` : k;
        if (typeof v === "number") numericPaths.push(p);
        else if (v && typeof v === "object") walk(v, p);
      }
    };
    walk(EMPTY_ASSUMPTIONS, "");
    expect(ALL_FIELDS.map((f) => f.path).sort()).toEqual(numericPaths.sort());
  });
});
