import { describe, expect, it } from "vitest";
import { IDS } from "@/lib/store/seed";
import { ensureBusinessOnboarded } from "@/lib/services/accounts";
import { uploadDocument } from "@/lib/services/documents";
import { createRequest, getRequestForCustomer, submitOffer } from "@/lib/services/marketplace";
import { acceptCurrentOffer, approveFinalTerms, businessRespond } from "@/lib/services/negotiations";
import { listLedger, verifyTransaction } from "@/lib/services/transactions";
import { enforceRateLimit } from "@/lib/services/rate-limit";
import { adminClient, anonClient, env, latestEmail, signedInAs, supabaseCtx, totp, uniqueEmail } from "./helpers";

const alex = { userId: IDS.alex, role: "customer" as const };
const ben = { userId: IDS.ben, role: "business" as const, businessId: IDS.bBen };

describe("Supabase Auth", () => {
  it("sign-up sends a confirmation email; the account works only after confirming", async () => {
    const email = uniqueEmail("signup");
    const c = anonClient();
    const { error } = await c.auth.signUp({ email, password: "a-strong-passphrase", options: { data: { name: "Test Customer", role: "customer" } } });
    expect(error).toBeNull();
    const blocked = await anonClient().auth.signInWithPassword({ email, password: "a-strong-passphrase" });
    expect(blocked.error?.code).toBe("email_not_confirmed");

    const mail = await latestEmail(email);
    const link = mail.text.match(/https?:\/\/\S+verify\S+/)?.[0];
    expect(link).toBeTruthy();
    const res = await fetch(link!, { redirect: "manual" });
    expect([302, 303]).toContain(res.status);

    const ok = await anonClient().auth.signInWithPassword({ email, password: "a-strong-passphrase" });
    expect(ok.error).toBeNull();
    const ctx = supabaseCtx();
    const profile = await ctx.store.get("users", ok.data.user!.id);
    expect(profile).toMatchObject({ email, name: "Test Customer", role: "customer", isDemo: false });
  });

  it("sign-up cannot request the admin role", async () => {
    const email = uniqueEmail("sneaky");
    const { data } = await adminClient().auth.admin.createUser({ email, password: "a-strong-passphrase", email_confirm: true, user_metadata: { role: "admin", name: "Sneaky" } });
    const profile = await supabaseCtx().store.get("users", data.user!.id);
    expect(profile?.role).toBe("customer");
  });

  it("business sign-up creates an UNVERIFIED business on first sign-in", async () => {
    const email = uniqueEmail("biz");
    const { data } = await adminClient().auth.admin.createUser({ email, password: "a-strong-passphrase", email_confirm: true, user_metadata: { role: "business", name: "Bo", business_name: "Bo's Plumbing", categories: ["trades"] } });
    const ctx = supabaseCtx();
    const profile = (await ctx.store.get("users", data.user!.id))!;
    const onboarded = await ensureBusinessOnboarded(ctx, profile, data.user!.user_metadata);
    const again = await ensureBusinessOnboarded(ctx, onboarded, data.user!.user_metadata);
    expect(again.businessId).toBe(onboarded.businessId); // idempotent
    const b = await ctx.store.get("businesses", onboarded.businessId!);
    expect(b).toMatchObject({ name: "Bo's Plumbing", verificationStatus: "unverified", categories: ["trades"] });
  });

  it("TOTP MFA: enrol, verify with a real code, session reaches AAL2", async () => {
    const email = uniqueEmail("mfa");
    await adminClient().auth.admin.createUser({ email, password: "a-strong-passphrase", email_confirm: true });
    const c = anonClient();
    await c.auth.signInWithPassword({ email, password: "a-strong-passphrase" });
    const { data: enrol, error } = await c.auth.mfa.enroll({ factorType: "totp" });
    expect(error).toBeNull();
    const bad = await c.auth.mfa.challengeAndVerify({ factorId: enrol!.id, code: "000000" });
    expect(bad.error).not.toBeNull();
    const good = await c.auth.mfa.challengeAndVerify({ factorId: enrol!.id, code: totp(enrol!.totp.secret) });
    expect(good.error).toBeNull();
    const { data: aal } = await c.auth.mfa.getAuthenticatorAssuranceLevel();
    expect(aal).toMatchObject({ currentLevel: "aal2", nextLevel: "aal2" });

    // A fresh password-only sign-in now needs the second factor.
    const c2 = anonClient();
    await c2.auth.signInWithPassword({ email, password: "a-strong-passphrase" });
    const { data: aal2 } = await c2.auth.mfa.getAuthenticatorAssuranceLevel();
    expect(aal2).toMatchObject({ currentLevel: "aal1", nextLevel: "aal2" });
  });
});

describe("Row-level security with real user tokens", () => {
  it("users read only their own rows and cannot write", async () => {
    const asAlex = await signedInAs("alex@demo.dealpilot.test");
    const asPriya = await signedInAs("priya@demo.dealpilot.test");
    expect((await asAlex.from("purchase_requests").select("id")).data).toHaveLength(1);
    expect((await asPriya.from("purchase_requests").select("id")).data).toHaveLength(0);
    expect((await asPriya.from("documents").select("id")).data).toHaveLength(0);
    expect((await asPriya.from("ledger_entries").select("id")).data).toHaveLength(0);
    expect((await asAlex.from("profiles").select("password_hash")).error).not.toBeNull();
    expect((await asAlex.from("negotiations").select("id")).error).not.toBeNull();
    const write = await asAlex.from("purchase_requests").update({ status: "completed" }).eq("customer_id", IDS.alex).select();
    expect(write.error ?? write.data?.length === 0).toBeTruthy();
    expect((await asAlex.rpc("apply_batch", { guards: [], ops: [] })).error).not.toBeNull();
    expect((await asAlex.rpc("rate_limit_hit", { p_key: "x", p_max: 1, p_window_seconds: 1 })).error).not.toBeNull();
  });

  it("anonymous clients see nothing private", async () => {
    const a = anonClient();
    for (const t of ["profiles", "documents", "purchase_requests", "transactions", "ledger_entries", "business_credentials"]) {
      const r = await a.from(t).select("id");
      expect(r.error !== null || r.data?.length === 0, t).toBe(true);
    }
  });
});

describe("Persistence and integrity through the Supabase driver", () => {
  it("negotiation → dual approval → verification persists; concurrent verifications assess one fee", async () => {
    const ctx = supabaseCtx();
    await businessRespond(ctx, ben, IDS.negFence, { action: "counter", priceCents: 480_000, message: "integration" });
    const proposed = await acceptCurrentOffer(ctx, alex, IDS.negFence, true);
    expect(proposed.state).toBe("final_approval");
    const agreed = await approveFinalTerms(ctx, ben, IDS.negFence, true);
    expect(agreed.state).toBe("agreed");

    // A different connection sees the persisted state.
    const fresh = supabaseCtx();
    const tx = (await fresh.store.list("transactions", { negotiationId: IDS.negFence }))[0];
    expect(tx).toMatchObject({ status: "pending_verification", periodSavingsCents: 70_000 });
    expect((await fresh.store.get("offers", IDS.offBen))?.status).toBe("accepted");
    expect((await fresh.store.get("offers", IDS.offHarbour))?.status).toBe("declined");

    const input = { method: "customer_confirmed_invoice" as const, finalCents: 480_000, confirmed: true };
    const results = await Promise.allSettled([verifyTransaction(ctx, alex, tx.id, input), verifyTransaction(supabaseCtx(), alex, tx.id, input), verifyTransaction(supabaseCtx(), alex, tx.id, input)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const fees = (await listLedger(fresh, alex)).filter((e) => e.transactionId === tx.id && e.type === "fee_assessed");
    expect(fees).toHaveLength(1);
    expect(fees[0].amountCents).toBe(150);
    expect((await fresh.store.get("negotiations", IDS.negFence))?.state).toBe("completed");
  });

  it("apply_batch is all-or-nothing and the ledger rejects duplicate fees", async () => {
    const ctx = supabaseCtx();
    const before = (await ctx.store.list("ledger")).length;
    await expect(ctx.store.atomic([], [
      { op: "insert", table: "ledger", row: { id: crypto.randomUUID(), transactionId: IDS.txCar, userId: IDS.alex, type: "fee_waived", amountCents: 0, currency: "AUD", idempotencyKey: `fresh-${Date.now()}`, simulated: true, createdAt: new Date().toISOString() } },
      { op: "insert", table: "ledger", row: { id: crypto.randomUUID(), transactionId: IDS.txCar, userId: IDS.alex, type: "fee_waived", amountCents: 0, currency: "AUD", idempotencyKey: `fee:${IDS.txCar}`, simulated: true, createdAt: new Date().toISOString() } },
    ])).rejects.toThrow(/duplicate key/);
    expect((await ctx.store.list("ledger")).length).toBe(before);
    await expect(ctx.store.update("ledger", (await ctx.store.list("ledger"))[0].id, { amountCents: 1 })).rejects.toThrow(/append-only/);
  });

  it("stale guards write nothing", async () => {
    const ctx = supabaseCtx();
    const ok = await ctx.store.atomic([{ table: "negotiations", id: IDS.negInternet, field: "version", equals: 999 }], [{ op: "update", table: "negotiations", id: IDS.negInternet, patch: { targetCents: 1 } }]);
    expect(ok).toBe(false);
    expect((await ctx.store.get("negotiations", IDS.negInternet))?.targetCents).toBe(8_400);
  });

  it("the database refuses offers from unverified businesses even if the app is bypassed", async () => {
    const ctx = supabaseCtx();
    const req = await createRequest(ctx, alex, { categoryId: "trades", title: "Integration gate", description: "", region: "Sydney NSW", baselineCents: 50_000, recurrence: "one_off", fields: { trade: "Fencing" } });
    await ctx.store.update("businesses", IDS.bBen, { verificationStatus: "pending" });
    try {
      await expect(submitOffer(ctx, ben, req.id, { priceCents: 40_000, scope: "x", materials: "", warrantyMonths: 0, completionDays: 1, includesInsurance: true, validDays: 7, aiDrafted: false })).rejects.toThrow(/not been verified/);
      const raw = await adminClient().from("offers").insert({ request_id: req.id, business_id: IDS.bBen, status: "submitted", price_cents: 1, recurrence: "one_off", scope: "x", valid_until: new Date().toISOString(), approved_by_user_id: IDS.ben });
      expect(raw.error?.message).toMatch(/not verified/);
    } finally {
      await ctx.store.update("businesses", IDS.bBen, { verificationStatus: "verified" });
    }
    expect((await getRequestForCustomer(ctx, alex, req.id)).comparison).toHaveLength(0);
  });

  it("reviews are only accepted for verified, real jobs", async () => {
    const r = await adminClient().from("reviews").insert({ transaction_id: IDS.txCar, business_id: IDS.bAutocare, customer_id: IDS.alex, rating: 5 });
    expect(r.error?.message).toMatch(/verified, real transaction/);
  });

  it("rate limits are shared and enforced in Postgres", async () => {
    const ctx = supabaseCtx();
    const key = `it-${Date.now()}`;
    for (let i = 0; i < 10; i++) await enforceRateLimit(ctx, "signIn", key);
    await expect(enforceRateLimit(ctx, "signIn", key)).rejects.toThrow(/Too many attempts/);
  });

  it("documents go to private Storage; other users can't read them", async () => {
    const ctx = supabaseCtx();
    const doc = await uploadDocument(ctx, alex, { filename: "bill.txt", mimeType: "text/plain", data: new TextEncoder().encode("Provider: X\nTOTAL: $99.00"), categoryId: "telco", kind: "bill" });
    expect((await ctx.store.getBlob(doc.storageKey))?.data.length).toBeGreaterThan(0);
    const asPriya = await signedInAs("priya@demo.dealpilot.test");
    const stolen = await asPriya.storage.from("documents").download(doc.storageKey);
    expect(stolen.data).toBeNull();
    const asAlex = await signedInAs("alex@demo.dealpilot.test");
    expect((await asAlex.storage.from("documents").download(doc.storageKey)).data).not.toBeNull();
    expect((await anonClient().storage.from("documents").download(doc.storageKey)).data).toBeNull();
    expect(env().url).toContain("127.0.0.1");
  });
});

describe("Business verification persisted in Supabase", () => {
  it("onboard → ABN → credential with evidence in Storage → admin review → verified", async () => {
    const { submitAbn, addCredential, confirmAbnManually, reviewCredential, setBusinessStatus } = await import("@/lib/services/verification");
    const ctx = supabaseCtx();
    const email = uniqueEmail("verify");
    const { data } = await adminClient().auth.admin.createUser({ email, password: "a-strong-passphrase", email_confirm: true, user_metadata: { role: "business", name: "Vee", business_name: "Vee's Electrical", categories: ["trades"] } });
    const profile = await ensureBusinessOnboarded(ctx, (await ctx.store.get("users", data.user!.id))!, data.user!.user_metadata);
    const actor = { userId: profile.id, role: "business" as const, businessId: profile.businessId };
    const admin = { userId: IDS.admin, role: "admin" as const };
    const noAbr = { configured: false, lookup: async () => ({ ok: false as const, reason: "not_configured" as const, message: "" }) };
    await submitAbn(ctx, actor, "51 824 753 556", noAbr);
    const pdf = new TextEncoder().encode("%PDF-1.4\n%%EOF");
    const lic = await addCredential(ctx, actor, { kind: "licence", reference: "EC-1", issuer: "NSW Fair Trading", jurisdiction: "NSW", expiresAt: "2028-01-01", evidence: { filename: "lic.pdf", mimeType: "application/pdf", data: pdf } });
    const ins = await addCredential(ctx, actor, { kind: "insurance", reference: "PL-9", issuer: "Insurer", jurisdiction: "NSW", expiresAt: "2028-01-01", evidence: { filename: "pl.pdf", mimeType: "application/pdf", data: pdf } });
    const evidence = await ctx.store.get("documents", lic.evidenceDocumentId!);
    expect(evidence?.kind).toBe("certificate");
    expect((await ctx.store.getBlob(evidence!.storageKey))?.data.length).toBeGreaterThan(0);
    // The database itself refuses a "verified" credential without a recorded check.
    const raw = await adminClient().from("business_credentials").update({ status: "verified" }).eq("id", lic.id);
    expect(raw.error?.message).toMatch(/verified_credential_has_check/);
    await expect(setBusinessStatus(ctx, admin, actor.businessId!, "verified", "")).rejects.toThrow(/Can't verify yet/);
    await confirmAbnManually(ctx, admin, actor.businessId!, "VEE ELECTRICAL PTY LTD");
    await reviewCredential(ctx, admin, lic.id, "verified", "Checked licence certificate");
    await reviewCredential(ctx, admin, ins.id, "verified", "Checked certificate of currency");
    const b = await setBusinessStatus(ctx, admin, actor.businessId!, "verified", "");
    expect(b).toMatchObject({ verificationStatus: "verified", verifiedBy: IDS.admin });
    // The business owner can read their own credentials through RLS; another business can't.
    const c = anonClient();
    await c.auth.signInWithPassword({ email, password: "a-strong-passphrase" });
    expect((await c.from("business_credentials").select("id")).data).toHaveLength(2);
    const asBen = await signedInAs("ben@demo.dealpilot.test");
    expect((await asBen.from("business_credentials").select("id").eq("business_id", actor.businessId!)).data).toHaveLength(0);
  });
});

describe("Account deletion with Supabase Auth", () => {
  it("anonymises the profile and blocks sign-in at the Auth layer", async () => {
    const { deleteMyAccount } = await import("@/lib/services/privacy");
    const { SupabaseStore } = await import("@/lib/store/supabase");
    const ctx = supabaseCtx();
    const email = uniqueEmail("leaver");
    const { data } = await adminClient().auth.admin.createUser({ email, password: "a-strong-passphrase", email_confirm: true, user_metadata: { name: "Leaver" } });
    const store = new SupabaseStore(env().url, env().service);
    await deleteMyAccount(ctx, { userId: data.user!.id, role: "customer" }, email, (id, anon) => store.disableAuthUser(id, anon));
    expect((await ctx.store.get("users", data.user!.id))?.name).toBe("Deleted user");
    const attempt = await anonClient().auth.signInWithPassword({ email, password: "a-strong-passphrase" });
    expect(attempt.error).not.toBeNull();
  });
});
