import { describe, expect, it } from "vitest";
import { CdrEnergyClient, compareEnergyPlans } from "@/lib/integrations/cdr-energy";
import { smtpEmailProvider } from "@/lib/integrations/notifications";
import { notify } from "@/lib/services/context";
import { adminClient, env, latestEmail, supabaseCtx, uniqueEmail } from "./helpers";

/**
 * Real external integrations. The Energy Made Easy test calls the public government API, so it
 * only runs with LIVE_NETWORK=1 (it must never be flaky CI's reason to fail).
 */
describe.skipIf(process.env.LIVE_NETWORK !== "1")("Energy Made Easy CDR (live)", () => {
  it("returns real, costed residential plans for a Sydney postcode", async () => {
    const r = await compareEnergyPlans(new CdrEnergyClient(), { postcode: "2000", dailyKwh: 12, brands: ["agl", "alinta"], taxRate: 0.1 });
    expect(r.brandsFailed).toEqual([]);
    expect(r.plans.length).toBeGreaterThan(3);
    for (const p of r.plans) {
      expect(p.planId).toMatch(/@EME$/);
      // Sanity bounds for NSW residential tariffs incl. GST: 10–80 c/kWh, $0.30–$4/day supply.
      expect(p.firstRateCentsPerKwh).toBeGreaterThan(10);
      expect(p.firstRateCentsPerKwh).toBeLessThan(80);
      expect(p.dailySupplyCents).toBeGreaterThan(30);
      expect(p.dailySupplyCents).toBeLessThan(400);
    }
  }, 120_000);
});

describe("SMTP email via the local stack's Mailpit", () => {
  it("delivers a notification email and logs it", async () => {
    const provider = smtpEmailProvider("smtp://127.0.0.1:54325", "DealPilot <no-reply@dealpilot.test>");
    const ctx = { ...supabaseCtx(), email: { provider, appUrl: "http://localhost:3000" } };
    const email = uniqueEmail("notify");
    const { data } = await adminClient().auth.admin.createUser({ email, password: "a-strong-passphrase", email_confirm: true, user_metadata: { name: "Notified" } });
    await notify(ctx, data.user!.id, { kind: "offer", title: "New offer from a verified business", body: "Open DealPilot to compare.", href: "/app/requests" });
    const mail = await latestEmail(email);
    expect(mail.subject).toBe("DealPilot: New offer from a verified business");
    expect(mail.text).toContain("http://localhost:3000/app/requests");
    const log = await ctx.store.list("notifications", { userId: data.user!.id });
    expect(log[0]).toMatchObject({ status: "sent", channel: "email" });
    expect(env().mailpit).toBeTruthy();
  });
});
