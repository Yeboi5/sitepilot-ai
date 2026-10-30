import { describe, expect, it } from "vitest";
import { decisionForDrag, deckReducer, initDeck, SWIPE_THRESHOLD } from "./deck";
import { parseGuestDecisions, savedIds } from "./guest-store";
import { grossYield } from "./signals";

const A = "30000000-0000-4000-8000-000000000001";
const B = "30000000-0000-4000-8000-000000000002";
const C = "30000000-0000-4000-8000-000000000003";

describe("deck reducer", () => {
  it("skips listings already decided", () => {
    expect(initDeck([A, B, C], new Set([B])).queue).toEqual([A, C]);
  });

  it("decides the top card and records history", () => {
    let s = initDeck([A, B, C]);
    s = deckReducer(s, { type: "decide", decision: "save" });
    s = deckReducer(s, { type: "decide", decision: "pass" });
    expect(s.queue).toEqual([C]);
    expect(s.history).toEqual([
      { id: A, decision: "save" },
      { id: B, decision: "pass" },
    ]);
  });

  it("undo puts the last card back on top", () => {
    let s = initDeck([A, B]);
    s = deckReducer(s, { type: "decide", decision: "save" });
    s = deckReducer(s, { type: "undo" });
    expect(s).toEqual({ queue: [A, B], history: [] });
  });

  it("is a no-op when empty or with nothing to undo", () => {
    const empty = initDeck([]);
    expect(deckReducer(empty, { type: "decide", decision: "save" })).toBe(empty);
    expect(deckReducer(empty, { type: "undo" })).toBe(empty);
  });

  it("reset starts again with everything", () => {
    const s = deckReducer(initDeck([A], new Set([A])), { type: "reset", ids: [A, B] });
    expect(s.queue).toEqual([A, B]);
  });
});

describe("drag to decision", () => {
  it.each([
    [SWIPE_THRESHOLD, "save"],
    [400, "save"],
    [-SWIPE_THRESHOLD, "pass"],
    [-400, "pass"],
    [SWIPE_THRESHOLD - 1, null],
    [0, null],
  ])("dx %s → %s", (dx, d) => expect(decisionForDrag(dx)).toBe(d));
});

describe("guest decisions in browser storage", () => {
  it("parses valid entries and drops anything else", () => {
    const raw = JSON.stringify({ [A]: "save", [B]: "pass", "not-a-uuid": "save", [C]: "delete-everything" });
    expect(parseGuestDecisions(raw)).toEqual({ [A]: "save", [B]: "pass" });
  });

  it.each([null, "", "{", "[]", "42", "null", '"x"'])("treats %s as empty", (raw) => {
    expect(parseGuestDecisions(raw)).toEqual({});
  });

  it("lists saved ids only", () => {
    expect(savedIds({ [A]: "save", [B]: "pass" })).toEqual([A]);
  });
});

describe("gross yield", () => {
  it("is weekly rent × 52 ÷ price", () => {
    expect(grossYield(800_000, 600)).toBe(0.039); // 31,200 / 800,000
  });
  it.each([
    [null, 600],
    [800_000, null],
    [0, 600],
    [800_000, 0],
  ])("is null without both inputs (%s, %s)", (p, r) => expect(grossYield(p, r)).toBeNull());
});

describe("area search", async () => {
  const { parseAreas, areaFilter, MAX_AREAS } = await import("./area");
  it("parses towns, suburbs and postcodes, de-duplicated", () => {
    expect(parseAreas("Newcastle, 2300 , newcastle, Wollongong NSW 2500")).toEqual({ suburbs: ["Newcastle", "Wollongong"], postcodes: ["2300"], labels: ["Newcastle", "Wollongong", "2300"] });
  });
  it("strips unsafe characters and caps the number of areas", () => {
    // Injection attempts end up as harmless, quoted suburb names.
    const q = parseAreas('Glenelg"),postcode.eq.0000');
    expect(q.suburbs).toEqual(["Glenelg", "postcode eq 0000"]);
    expect(areaFilter(q)).toBe('suburb.ilike."Glenelg",suburb.ilike."postcode eq 0000"');
    expect(parseAreas("A,B,C,D,E,F,G").labels).toHaveLength(MAX_AREAS);
    expect(parseAreas("   ,  ")).toEqual({ suburbs: [], postcodes: [], labels: [] });
  });
  it("builds a quoted PostgREST filter", () => {
    expect(areaFilter(parseAreas("Mount Barker, 2300"))).toBe('suburb.ilike."Mount Barker",postcode.eq.2300');
    expect(areaFilter(parseAreas(""))).toBeNull();
  });
});

describe("Discover filters", async () => {
  const { parseFilters, applyFilters, filterParams, activeCount } = await import("./filters");
  const L = (id: string, o: Record<string, unknown>) =>
    ({ id, state: "NSW", asking_price: 800_000, property_type: "house", bedrooms: 3, bathrooms: 2, car_spaces: 1, land_area_sqm: 500, indicative_weekly_rent: null, listed_on: "2026-10-01", ...o }) as never;
  const list = [
    L("a", { asking_price: 450_000, property_type: "apartment", bedrooms: 2, bathrooms: 1, land_area_sqm: null }),
    L("b", { asking_price: 950_000, bedrooms: 4, car_spaces: 2, land_area_sqm: 700, indicative_weekly_rent: 1_000 }),
    L("c", { asking_price: 600_000, property_type: "land", bedrooms: 0, bathrooms: 0, car_spaces: 0, land_area_sqm: 600 }),
    L("d", { state: "VIC", asking_price: 700_000, indicative_weekly_rent: 700 }),
  ];
  const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

  it("parses only allowed values and swaps a reversed price range", () => {
    const f = parseFilters({ min: "1000000", max: "500000", type: "house,land,castle", beds: "9", baths: "-1", land: "123", yield: "5", sort: "nope", state: "XX" }, "home");
    expect(f).toMatchObject({ priceMin: 500_000, priceMax: 1_000_000, types: ["house", "land"], beds: 6, baths: 0, landMin: null, yieldMin: null, sort: "newest", state: null });
  });

  it("filters by price, type, rooms and land", () => {
    const f = (raw: Record<string, string>) => ids(applyFilters(list, parseFilters(raw, "home"), "for_sale"));
    expect(f({ min: "500000", max: "900000" })).toEqual(["c", "d"]);
    expect(f({ type: "apartment,land" })).toEqual(["a", "c"]);
    expect(f({ beds: "3", baths: "2" })).toEqual(["b", "d"]);
    expect(f({ cars: "2" })).toEqual(["b"]);
    expect(f({ land: "600" })).toEqual(["b", "c"]);
    expect(f({ state: "VIC" })).toEqual(["d"]);
  });

  it("filters investments by minimum gross yield (unknown yield is excluded)", () => {
    // b: 52,000 ÷ 950,000 = 5.5%; d: 36,400 ÷ 700,000 = 5.2%
    expect(ids(applyFilters(list, parseFilters({ yield: "5" }, "investment"), "for_sale"))).toEqual(["b", "d"]);
    expect(ids(applyFilters(list, parseFilters({ yield: "6" }, "investment"), "for_sale"))).toEqual([]);
  });

  it("sorts by price, and ignores price on the off-market tab", () => {
    expect(ids(applyFilters(list, parseFilters({ sort: "price_asc" }, "home"), "for_sale"))).toEqual(["a", "c", "d", "b"]);
    expect(ids(applyFilters(list, parseFilters({ sort: "price_desc" }, "home"), "for_sale"))).toEqual(["b", "d", "c", "a"]);
    const offMarket = list.map((l) => ({ ...(l as object), asking_price: null })) as never[];
    expect(applyFilters(offMarket, parseFilters({ min: "500000", max: "600000" }, "home"), "off_market")).toHaveLength(4);
  });

  it("round-trips to URL parameters and counts active filters", () => {
    const f = parseFilters({ min: "500000", type: "house", beds: "2", sort: "price_asc" }, "home");
    expect(filterParams(f)).toEqual({ min: "500000", type: "house", beds: "2", sort: "price_asc" });
    expect(activeCount(f)).toBe(3);
    expect(activeCount(f, "off_market")).toBe(2); // the price filter doesn't apply off-market
  });
});
