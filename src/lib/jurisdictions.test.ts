import { describe, expect, it } from "vitest";
import { dateForProperty, localDate } from "./dates";
import { STATES, isPostcodeInState, isState, timeZoneFor, type State } from "./jurisdictions";
import { evidenceSchema, propertySchema } from "./validation";

describe("isPostcodeInState", () => {
  const valid: [State, string][] = [
    ["NSW", "2000"], ["NSW", "2150"], ["NSW", "2262"], ["NSW", "2880"], ["NSW", "1100"],
    ["ACT", "2600"], ["ACT", "2913"], ["ACT", "0200"],
    ["VIC", "3000"], ["VIC", "3350"], ["VIC", "8001"],
    ["QLD", "4000"], ["QLD", "4870"], ["QLD", "9726"],
    ["SA", "5000"], ["SA", "5950"],
    ["WA", "6000"], ["WA", "6725"],
    ["TAS", "7000"], ["TAS", "7250"],
    ["NT", "0800"], ["NT", "0870"],
  ];
  it.each(valid)("%s accepts %s", (state, pc) => expect(isPostcodeInState(state, pc)).toBe(true));

  const invalid: [State, string][] = [
    ["NSW", "2600"], // Canberra is ACT
    ["ACT", "2620"], // Queanbeyan is NSW
    ["VIC", "2000"],
    ["QLD", "3000"],
    ["WA", "5000"],
    ["NT", "6000"],
    ["TAS", "800"],
    ["NSW", "abcd"],
  ];
  it.each(invalid)("%s rejects %s", (state, pc) => expect(isPostcodeInState(state, pc)).toBe(false));

  it("every state has at least one range", () => {
    for (const s of STATES) expect(isState(s)).toBe(true);
    expect(isState("XX")).toBe(false);
  });
});

describe("time zones", () => {
  it("maps states to their zone, with Broken Hill on South Australian time", () => {
    expect(timeZoneFor("NSW", "2000")).toBe("Australia/Sydney");
    expect(timeZoneFor("NSW", "2880")).toBe("Australia/Broken_Hill");
    expect(timeZoneFor("WA")).toBe("Australia/Perth");
    expect(timeZoneFor("QLD")).toBe("Australia/Brisbane");
    expect(timeZoneFor("NT")).toBe("Australia/Darwin");
  });

  it("'today' differs across the country at the same instant", () => {
    // 14:30 UTC on 29 Oct: 01:30 on the 30th in Sydney (AEDT), 22:30 on the 29th in Perth.
    const at = new Date("2026-10-29T14:30:00Z");
    expect(localDate("Australia/Sydney", at)).toBe("2026-10-30");
    expect(localDate("Australia/Perth", at)).toBe("2026-10-29");
    expect(dateForProperty({ jurisdiction: "WA", postcode: "6000" }, at)).toBe("2026-10-29");
    expect(dateForProperty({ jurisdiction: "NSW", postcode: "2000" }, at)).toBe("2026-10-30");
  });

  it("Queensland has no daylight saving", () => {
    // 14:30 UTC on 29 Oct is 00:30 on the 30th in Brisbane (AEST, +10).
    expect(localDate("Australia/Brisbane", new Date("2026-10-29T14:30:00Z"))).toBe("2026-10-30");
    expect(localDate("Australia/Brisbane", new Date("2026-10-29T13:30:00Z"))).toBe("2026-10-29");
  });
});

describe("evidence dates in the property's time zone", () => {
  const base = { title: "Cert", sourceType: "planning_certificate", sourceUrl: "https://example.com/c.pdf" };
  const at = new Date("2026-10-29T14:30:00Z");

  it("accepts the 30th for a Sydney property but not for a Perth one", () => {
    expect(evidenceSchema(at, "Australia/Sydney").safeParse({ ...base, fetchedAt: "2026-10-30" }).success).toBe(true);
    expect(evidenceSchema(at, "Australia/Perth").safeParse({ ...base, fetchedAt: "2026-10-30" }).success).toBe(false);
    expect(evidenceSchema(at, "Australia/Perth").safeParse({ ...base, fetchedAt: "2026-10-29" }).success).toBe(true);
  });
});

describe("propertySchema (nationwide)", () => {
  const base = { address: "1 Collins Street", suburb: "Melbourne", postcode: "3000" };

  it("accepts a property in its own state", () => {
    expect(propertySchema.parse({ ...base, state: "VIC" }).state).toBe("VIC");
  });

  it("rejects a postcode from another state, against the postcode field", () => {
    const r = propertySchema.safeParse({ ...base, state: "NSW" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]!.path).toEqual(["postcode"]);
  });

  it("defaults to NSW when no state is given", () => {
    expect(propertySchema.parse({ address: "1 George St", suburb: "Sydney", postcode: "2000" }).state).toBe("NSW");
  });

  it("rejects unknown states and malformed postcodes", () => {
    expect(propertySchema.safeParse({ ...base, state: "XX" }).success).toBe(false);
    expect(propertySchema.safeParse({ ...base, state: "VIC", postcode: "30000" }).success).toBe(false);
  });
});
