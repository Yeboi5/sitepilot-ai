import { describe, expect, it } from "vitest";
import { formatAud, formatAudDelta, formatRatio } from "./format";

describe("money and ratio formatting", () => {
  it("formats AUD with a true minus sign", () => {
    expect(formatAud(1234567.89)).toBe("$1,234,568");
    expect(formatAud(-47800)).toBe("−$47,800");
  });
  it("formats signed deltas", () => {
    expect(formatAudDelta(12000)).toBe("+$12,000");
    expect(formatAudDelta(-4500)).toBe("−$4,500");
    expect(formatAudDelta(0.2)).toBe("$0");
  });
  it("formats ratios and missing ratios", () => {
    expect(formatRatio(0.145585)).toBe("14.6%");
    expect(formatRatio(-0.02)).toBe("−2.0%");
    expect(formatRatio(null)).toBe("n/a");
  });
});
