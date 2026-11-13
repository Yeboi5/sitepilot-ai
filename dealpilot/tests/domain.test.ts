import { describe, expect, it } from "vitest";
import { extractAmounts } from "@/lib/ai/mock";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import { signSession, verifySession } from "@/lib/auth/token";
import { CATEGORIES, validateCategoryFields } from "@/lib/domain/categories";
import { analyseExpenses, parseExpenseCsv } from "@/lib/domain/guardian";
import { groupStatus, validateTiers } from "@/lib/domain/groups";
import { formatMoney, parseMoney } from "@/lib/domain/money";
import { canTransition, checkAutopilot, InvalidTransitionError, recommendResponse, transition } from "@/lib/domain/negotiation";
import { calculateFee, calculateSavings } from "@/lib/domain/savings";
import type { ExpenseLine, PurchasingGroup } from "@/lib/domain/types";
import { sniffMatches } from "@/lib/services/documents";
import { rowFromDb, rowToDb } from "@/lib/store/supabase";
import { MemoryStore } from "@/lib/store/memory";

describe("money", () => {
  it("parses to integer cents without float drift", () => {
    expect(parseMoney("$5,500.00")).toBe(550_000);
    expect(parseMoney("0.1")).toBe(10);
    expect(parseMoney("19.99")).toBe(1999);
    expect(parseMoney("1.234")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
    expect(formatMoney(550_000)).toBe("$5,500.00");
  });
});

describe("savings and fees", () => {
  it("annualises recurring savings and never reports negative savings", () => {
    expect(calculateSavings(12_000, 9_300, "monthly")).toMatchObject({ periodSavingsCents: 2_700, annualSavingsCents: 32_400, percent: 22.5 });
    expect(calculateSavings(1_000, 1_200, "one_off")).toMatchObject({ periodSavingsCents: 0, isSaving: false });
    expect(() => calculateSavings(10.5, 5, "one_off")).toThrow();
  });
  it("charges the fee only for verified savings and never more than the saving", () => {
    const cfg = { successFeeCents: 150, currency: "AUD" };
    expect(calculateFee({ status: "pending_verification", periodSavingsCents: 5000 }, cfg).feeCents).toBe(0);
    expect(calculateFee({ status: "verified", periodSavingsCents: 0 }, cfg).feeCents).toBe(0);
    expect(calculateFee({ status: "verified", periodSavingsCents: 100 }, cfg).feeCents).toBe(100);
    expect(calculateFee({ status: "verified", periodSavingsCents: 80_000 }, cfg).feeCents).toBe(150);
  });
});

describe("negotiation state machine", () => {
  it("allows only defined transitions", () => {
    expect(transition("awaiting_approval", "SEND")).toBe("awaiting_counterparty");
    expect(transition("agreed", "COMPLETE")).toBe("completed");
    expect(canTransition("completed", "ACCEPT")).toBe(false);
    expect(() => transition("declined", "SEND")).toThrow(InvalidTransitionError);
    expect(() => transition("awaiting_counterparty", "COMPLETE")).toThrow();
  });
  it("recommends accept / counter / escalate deterministically", () => {
    expect(recommendResponse({ targetCents: 9000, currentOfferCents: 8900, messages: [] }).action).toBe("accept");
    expect(recommendResponse({ targetCents: 8400, currentOfferCents: 10200, messages: [] })).toMatchObject({ action: "counter", priceCents: 9300 });
    const sent = Array.from({ length: 3 }, (_, i) => ({ id: `${i}`, at: "", from: "ai" as const, kind: "sent" as const, body: "", amountCents: 1 }));
    expect(recommendResponse({ targetCents: 8400, currentOfferCents: 10200, messages: sent }).action).toBe("escalate");
    expect(recommendResponse({ targetCents: 9900, currentOfferCents: 10000, messages: [] }).action).toBe("escalate");
  });
  it("autopilot is limited to simulated counterparties, spending limits and target price", () => {
    const n = { mode: "autopilot" as const, simulated: true, targetCents: 9000 };
    expect(checkAutopilot(n, "send", 8000, 10_000).allowed).toBe(true);
    expect(checkAutopilot(n, "send", 12_000, 10_000).allowed).toBe(false);
    expect(checkAutopilot(n, "accept", 9500, 10_000).allowed).toBe(false);
    expect(checkAutopilot({ ...n, simulated: false }, "send", 8000, 10_000).allowed).toBe(false);
    expect(checkAutopilot({ ...n, mode: "approval" }, "send", 8000, 10_000).allowed).toBe(false);
  });
});

describe("categories", () => {
  it("every category has weights summing to 1", () => {
    for (const c of CATEGORIES) {
      const sum = Object.values(c.weights).reduce((a, b) => a + b, 0);
      expect(Math.round(sum * 100)).toBe(100);
    }
  });
  it("validates category-specific fields", () => {
    expect(validateCategoryFields("trades", {}).ok).toBe(false);
    expect(validateCategoryFields("trades", { trade: "Spaceship" }).ok).toBe(false);
    const ok = validateCategoryFields("trades", { trade: "Fencing", size: "30", removal: "on" });
    expect(ok).toEqual({ ok: true, fields: { trade: "Fencing", size: 30, removal: true } });
  });
});

describe("groups", () => {
  it("validates tiers", () => {
    expect(validateTiers([])).not.toBeNull();
    expect(validateTiers([{ minMembers: 5, priceCents: 100 }, { minMembers: 10, priceCents: 90 }])).toBeNull();
    expect(validateTiers([{ minMembers: 1, priceCents: 100 }])).not.toBeNull();
  });
  it("ignores expired offers", () => {
    const g = { memberIds: ["a"], simulatedMemberCount: 9, baselineCents: 1000, expiresAt: "2030-01-01", offers: [{ id: "o", businessId: "b", tiers: [{ minMembers: 2, priceCents: 800 }], terms: "", validUntil: "2020-01-01", isSimulated: true, createdAt: "" }] } as unknown as PurchasingGroup;
    expect(groupStatus(g, new Date("2026-01-01")).currentPriceCents).toBeUndefined();
  });
});

describe("money guardian", () => {
  const line = (id: string, date: string, merchant: string, amountCents: number): ExpenseLine => ({ id, userId: "u", date, merchant, amountCents, source: "manual", createdAt: "" });
  it("finds duplicates, subscriptions and price creep", () => {
    const f = analyseExpenses([
      line("1", "2026-01-05", "Shop", 5000), line("2", "2026-01-06", "Shop", 5000),
      line("3", "2026-01-01", "Stream", 1000), line("4", "2026-01-31", "Stream", 1000), line("5", "2026-03-02", "Stream", 1200),
    ]);
    expect(f.map((x) => x.kind).sort()).toEqual(["duplicate_charge", "price_creep", "subscription"]);
  });
  it("parses CSV and rejects account-number-like merchants", () => {
    const r = parseExpenseCsv("date,merchant,amount\n2026-01-01,Gym,64.95\n2026-01-02,Acct 12345678,10\nbad,row,1");
    expect(r.rows).toEqual([{ date: "2026-01-01", merchant: "Gym", amountCents: 6495 }]);
    expect(r.errors).toHaveLength(2);
  });
});

describe("security primitives", () => {
  it("signs and verifies sessions; rejects tampering and expiry", () => {
    const t = signSession({ uid: "u1", exp: 2_000_000_000 }, "s".repeat(32));
    expect(verifySession(t, "s".repeat(32), 1_000)?.uid).toBe("u1");
    expect(verifySession(t, "x".repeat(32), 1_000)).toBeNull();
    const [body, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ uid: "admin", exp: 2_000_000_000 })).toString("base64url");
    expect(verifySession(`${forged}.${sig}`, "s".repeat(32))).toBeNull();
    expect(verifySession(`${body}.${sig}`, "s".repeat(32), 3_000_000_000_000)).toBeNull();
  });
  it("hashes passwords with scrypt", () => {
    const h = hashPassword("correct horse battery");
    expect(verifyPassword("correct horse battery", h)).toBe(true);
    expect(verifyPassword("wrong", h)).toBe(false);
  });
  it("checks uploaded file magic bytes", () => {
    expect(sniffMatches("application/pdf", new TextEncoder().encode("%PDF-1.7"))).toBe(true);
    expect(sniffMatches("application/pdf", new TextEncoder().encode("MZ\x90"))).toBe(false);
    expect(sniffMatches("text/plain", new Uint8Array([65, 0, 66]))).toBe(false);
  });
  it("memory store keeps ledger append-only and idempotent", async () => {
    const s = new MemoryStore();
    const e = { id: "1", transactionId: "t", userId: "u", type: "fee_charged" as const, amountCents: 150, currency: "AUD", idempotencyKey: "fee:t", simulated: true, createdAt: "" };
    await s.insert("ledger", e);
    await expect(s.insert("ledger", { ...e, id: "2" })).rejects.toThrow(/idempotency/);
    await expect(s.update("ledger", "1", { amountCents: 0 })).rejects.toThrow(/append-only/);
  });
});

describe("AI mock extraction & supabase mapping", () => {
  it("extracts totals and line items from text", () => {
    const r = extractAmounts("Vendor: Acme\nPlan fee: $110.00\nModem: $10.00\nAmount due: $120.00 per month");
    expect(r).toMatchObject({ total: 12_000, vendor: "Acme", recurrence: "monthly" });
    expect(r.lines).toHaveLength(2);
  });
  it("maps camelCase rows to snake_case columns and back", () => {
    const db = rowToDb({ id: "1", baselineCents: 5, passwordHash: "secret", documentId: undefined });
    expect(db).toEqual({ id: "1", baseline_cents: 5 });
    expect(rowFromDb({ id: "1", baseline_cents: 5, document_id: null })).toEqual({ id: "1", baselineCents: 5 });
  });
});
