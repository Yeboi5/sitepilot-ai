import { describe, expect, it } from "vitest";
import { evidenceSchema, isNswPostcode, propertySchema, signUpSchema } from "./validation";
import { safeNextPath, isProtectedPath } from "./routes";
import { sydneyDate } from "./dates";

describe("isNswPostcode", () => {
  it.each(["2000", "2150", "2750", "2619", "2999", "1100"])("accepts %s", (p) => expect(isNswPostcode(p)).toBe(true));
  it.each(["2600", "2618", "2900", "2920", "3000", "0800", "215", "21500", "abcd"])("rejects %s", (p) =>
    expect(isNswPostcode(p)).toBe(false),
  );
});

describe("propertySchema", () => {
  it("normalises an empty lot/DP to null", () => {
    const r = propertySchema.parse({ address: "12 Example St", suburb: "Parramatta", postcode: "2150", lotDp: "" });
    expect(r.lotDp).toBeNull();
  });
  it("rejects non-NSW postcodes", () => {
    expect(propertySchema.safeParse({ address: "1 Collins St", suburb: "Melbourne", postcode: "3000" }).success).toBe(false);
  });
});

describe("evidenceSchema", () => {
  const today = new Date("2026-10-29T00:00:00Z");
  const base = { title: "Cert", sourceType: "planning_certificate", sourceUrl: "https://example.com/c.pdf", fetchedAt: "2026-10-01" };

  it("accepts a well-formed record", () => {
    expect(evidenceSchema(today).safeParse(base).success).toBe(true);
  });
  it("rejects http sources", () => {
    expect(evidenceSchema(today).safeParse({ ...base, sourceUrl: "http://example.com" }).success).toBe(false);
  });
  it("rejects javascript: URLs", () => {
    expect(evidenceSchema(today).safeParse({ ...base, sourceUrl: "javascript:alert(1)" }).success).toBe(false);
  });
  it("rejects future retrieval dates", () => {
    expect(evidenceSchema(today).safeParse({ ...base, fetchedAt: "2026-11-01" }).success).toBe(false);
  });
  it("uses the Sydney calendar date, not UTC", () => {
    // 13:23 UTC on 29 Oct is 00:23 on 30 Oct in Sydney (AEDT): "today" is the 30th.
    const sydneyMorning = new Date("2026-10-29T13:23:00Z");
    expect(evidenceSchema(sydneyMorning).safeParse({ ...base, fetchedAt: "2026-10-30" }).success).toBe(true);
    expect(evidenceSchema(sydneyMorning).safeParse({ ...base, fetchedAt: "2026-10-31" }).success).toBe(false);
  });
  it("rejects unknown source types", () => {
    expect(evidenceSchema(today).safeParse({ ...base, sourceType: "zoning_ai_guess" }).success).toBe(false);
  });
});

describe("signUpSchema", () => {
  it("requires a 12+ character password with a letter and a number", () => {
    const base = { displayName: "Ivy", email: "ivy@example.com" };
    expect(signUpSchema.safeParse({ ...base, password: "short1" }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...base, password: "onlylettersssss" }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...base, password: "correct horse 42" }).success).toBe(true);
  });
});

describe("safeNextPath", () => {
  it.each([
    ["/investor/properties", "/investor/properties"],
    ["/firm?tab=queue", "/firm?tab=queue"],
    ["//evil.example", "/dashboard"],
    ["/\\evil.example", "/dashboard"],
    ["https://evil.example", "/dashboard"],
    ["javascript:alert(1)", "/dashboard"],
    [undefined, "/dashboard"],
  ])("%s → %s", (input, expected) => expect(safeNextPath(input)).toBe(expected));
});

describe("isProtectedPath", () => {
  it("protects app areas but not marketing pages", () => {
    expect(isProtectedPath("/investor")).toBe(true);
    expect(isProtectedPath("/firm/review")).toBe(true);
    expect(isProtectedPath("/settings")).toBe(true);
    expect(isProtectedPath("/my-property/abc")).toBe(true);
    expect(isProtectedPath("/verify")).toBe(true);
    expect(isProtectedPath("/search")).toBe(false);
    expect(isProtectedPath("/vision")).toBe(false);
    expect(isProtectedPath("/vision/new")).toBe(true);
    expect(isProtectedPath("/vision/0b8f3c1e-0000-4000-8000-000000000001")).toBe(true);
    expect(isProtectedPath("/vision/shared/abc")).toBe(false);
    expect(isProtectedPath("/compare")).toBe(false);
    expect(isProtectedPath("/compare/0b8f3c1e-0000-4000-8000-000000000001")).toBe(true);
    expect(isProtectedPath("/compare/shared/abc")).toBe(false);
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/pricing")).toBe(false);
    expect(isProtectedPath("/investorship")).toBe(false);
  });
});

describe("sydneyDate", () => {
  it("handles daylight saving and standard time", () => {
    expect(sydneyDate(new Date("2026-10-29T12:59:00Z"))).toBe("2026-10-29"); // 23:59 AEDT
    expect(sydneyDate(new Date("2026-10-29T13:00:00Z"))).toBe("2026-10-30"); // 00:00 AEDT
    expect(sydneyDate(new Date("2026-07-01T13:59:00Z"))).toBe("2026-07-01"); // 23:59 AEST
    expect(sydneyDate(new Date("2026-07-01T14:00:00Z"))).toBe("2026-07-02"); // 00:00 AEST
  });
});

describe("signUpSchema account type", () => {
  const base = { displayName: "Nina", email: "nina@example.com", password: "correct horse 42" };
  it("defaults to a consumer account", () => {
    expect(signUpSchema.parse(base).accountType).toBe("consumer");
  });
  it("accepts the firm checkbox", () => {
    expect(signUpSchema.parse({ ...base, accountType: "professional" }).accountType).toBe("professional");
  });
  it("rejects anything else", () => {
    expect(signUpSchema.safeParse({ ...base, accountType: "admin" }).success).toBe(false);
  });
});
