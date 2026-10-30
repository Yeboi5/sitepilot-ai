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
