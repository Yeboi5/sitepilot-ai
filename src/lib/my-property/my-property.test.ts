import { describe, expect, it } from "vitest";
import { portalLinks } from "@/lib/address/links";
import { checkEvidence, safeFileName, sniffEvidenceType, EVIDENCE_MAX_BYTES } from "@/lib/storage/file-check";

describe("portal links (plain outbound links, no data copied)", () => {
  it("builds suburb search links", () => {
    expect(portalLinks("Parramatta", "NSW", "2150")).toEqual([
      { name: "Domain", href: "https://www.domain.com.au/sale/parramatta-nsw-2150/" },
      { name: "realestate.com.au", href: "https://www.realestate.com.au/buy/in-parramatta%2C+nsw+2150/list-1" },
    ]);
  });
  it("handles multi-word suburbs", () => {
    expect(portalLinks("Mount Barker", "SA", "5251")[0]!.href).toBe("https://www.domain.com.au/sale/mount-barker-sa-5251/");
  });
  it("returns nothing for invalid input (never a malformed or injected URL)", () => {
    expect(portalLinks("x", "ZZ", "2000")).toEqual([]);
    expect(portalLinks("Sydney", "NSW", "abc")).toEqual([]);
    expect(portalLinks("  ", "NSW", "2000")).toEqual([]);
    expect(portalLinks('"><script>', "NSW", "2000")[0]!.href).toBe("https://www.domain.com.au/sale/script-nsw-2000/");
  });
});

describe("evidence file checks", () => {
  const pdf = new TextEncoder().encode("%PDF-1.7\n...");
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2]);
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);

  it("identifies files by content, not name", () => {
    expect(sniffEvidenceType(pdf)?.mime).toBe("application/pdf");
    expect(sniffEvidenceType(jpg)?.mime).toBe("image/jpeg");
    expect(sniffEvidenceType(png)?.mime).toBe("image/png");
    expect(sniffEvidenceType(new TextEncoder().encode("<html><script>"))).toBeNull();
    expect(sniffEvidenceType(new TextEncoder().encode("MZ\x90\x00"))).toBeNull(); // .exe
  });

  it("rejects empty, oversized and unknown files", () => {
    expect(checkEvidence(new Uint8Array())).toEqual({ ok: false, error: "Choose a file to upload." });
    const big = new Uint8Array(EVIDENCE_MAX_BYTES + 1);
    big.set(pdf);
    expect(checkEvidence(big).ok).toBe(false);
    expect(checkEvidence(new TextEncoder().encode("hello")).ok).toBe(false);
    expect(checkEvidence(pdf).ok).toBe(true);
  });

  it("sanitises display names", () => {
    expect(safeFileName("../../etc/passwd")).toBe(".._.._etc_passwd");
    expect(safeFileName("Rates notice 2026.pdf")).toBe("Rates notice 2026.pdf");
    expect(safeFileName("<>")).toBe("_");
    expect(safeFileName("")).toBe("evidence");
  });
});

describe("address query normalisation", () => {
  it("keeps letters, digits and spaces only", async () => {
    const { normaliseQuery } = await import("@/lib/address/query");
    expect(normaliseQuery("  12 Example   St, Parramatta  ")).toBe("12 Example St Parramatta");
    expect(normaliseQuery("x),suburb.eq.y")).toBe("x suburb eq y");
    expect(normaliseQuery("%_*")).toBe("");
    expect(normaliseQuery("Mt. Barker")).toBe("Mt Barker");
    expect(normaliseQuery("a".repeat(200))).toHaveLength(80);
  });
});
