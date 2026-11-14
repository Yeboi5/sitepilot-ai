import { describe, expect, it } from "vitest";
import { authenticate } from "@/lib/services/accounts";
import { acceptCurrentOffer, approveFinalTerms, businessRespond } from "@/lib/services/negotiations";
import { deleteMyAccount, exportMyData } from "@/lib/services/privacy";
import { DEMO_PASSWORD, IDS } from "@/lib/store/seed";
import { alex, ben, makeCtx, priya } from "./helpers";

describe("privacy: access and deletion", () => {
  it("exports a customer's data without secrets or storage keys", async () => {
    const ctx = await makeCtx();
    const data = await exportMyData(ctx, alex);
    const json = JSON.stringify(data);
    expect(json).not.toContain("scrypt$");
    expect(json).not.toContain("storageKey");
    expect(data.requests).toHaveLength(1);
    expect(data.negotiations.some((n) => n.targetCents > 0)).toBe(true); // the customer's own targets
  });

  it("a business export never contains customer targets or AI notes", async () => {
    const ctx = await makeCtx();
    const data = await exportMyData(ctx, ben);
    expect(data.negotiations.every((n) => n.targetCents === 0 && !n.messages.some((m) => m.kind === "analysis"))).toBe(true);
    expect(data.businessCredentials.length).toBeGreaterThan(0);
  });

  it("deletion requires typing the email, refuses while deals are pending, then anonymises", async () => {
    const ctx = await makeCtx();
    await expect(deleteMyAccount(ctx, priya, "wrong@example.test")).rejects.toThrow(/exactly/);
    await deleteMyAccount(ctx, priya, "priya@demo.dealpilot.test");
    const p = (await ctx.store.get("users", IDS.priya))!;
    expect(p).toMatchObject({ name: "Deleted user" });
    expect(p.deletedAt).toBeTruthy();
    expect(p.email).toMatch(/@deleted\.invalid$/);
    expect((await ctx.store.get("groups", IDS.grpSolar))!.memberIds).not.toContain(IDS.priya);
    await expect(authenticate(ctx, "priya@demo.dealpilot.test", DEMO_PASSWORD)).rejects.toThrow();

    // Pending deals must be resolved first.
    await businessRespond(ctx, ben, IDS.negFence, { action: "counter", priceCents: 480_000, message: "" });
    await acceptCurrentOffer(ctx, alex, IDS.negFence, true);
    await approveFinalTerms(ctx, ben, IDS.negFence, true);
    await expect(deleteMyAccount(ctx, alex, "alex@demo.dealpilot.test")).rejects.toThrow(/pending deals/);
  });

  it("deleting removes document files but keeps anonymised financial records", async () => {
    const ctx = await makeCtx();
    const docs = await ctx.store.list("documents", { ownerId: IDS.alex });
    await deleteMyAccount(ctx, alex, "alex@demo.dealpilot.test");
    for (const d of docs) expect(await ctx.store.getBlob(d.storageKey)).toBeUndefined();
    expect(await ctx.store.get("transactions", IDS.txCar)).toBeTruthy();
    expect((await ctx.store.list("ledger", { userId: IDS.alex })).length).toBeGreaterThan(0);
  });
});
