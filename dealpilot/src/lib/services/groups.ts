import { formatMoney } from "../domain/money";
import { checkEligibility, groupStatus, validateTiers } from "../domain/groups";
import { NotFoundError, requireRole, ValidationError } from "../domain/permissions";
import type { Actor, GroupOffer, Negotiation, PriceTier } from "../domain/types";
import { audit, newId, notify, type Ctx } from "./context";
import { proposeFinalTerms } from "./transactions";
import { myBusiness } from "./marketplace";

export async function listGroups(ctx: Ctx) {
  const groups = await ctx.store.list("groups");
  const now = ctx.now();
  return groups.map((g) => ({ group: g, status: groupStatus(g, now) })).sort((a, b) => a.status.daysLeft - b.status.daysLeft);
}

export async function getGroup(ctx: Ctx, actor: Actor, id: string) {
  const g = await ctx.store.get("groups", id);
  if (!g) throw new NotFoundError("Group");
  const user = (await ctx.store.get("users", actor.userId))!;
  const businesses = new Map((await ctx.store.list("businesses")).map((b) => [b.id, b]));
  const takenUp = actor.role === "customer" ? (await ctx.store.list("transactions", { customerId: actor.userId })).find((t) => t.groupId === id) : undefined;
  return {
    // Members' identities are private: only counts are exposed.
    group: { ...g, memberIds: g.memberIds.includes(actor.userId) ? [actor.userId] : [] },
    isMember: g.memberIds.includes(actor.userId),
    status: groupStatus(g, ctx.now()),
    eligibility: checkEligibility(g, user, ctx.now()),
    businesses,
    takenUp,
  };
}

export async function joinGroup(ctx: Ctx, actor: Actor, id: string) {
  requireRole(actor, "customer");
  const g = await ctx.store.get("groups", id);
  if (!g) throw new NotFoundError("Group");
  const user = (await ctx.store.get("users", actor.userId))!;
  const e = checkEligibility(g, user, ctx.now());
  if (!e.eligible) throw new ValidationError(e.reason);
  const before = groupStatus(g, ctx.now());
  const updated = await ctx.store.update("groups", id, { memberIds: [...g.memberIds, actor.userId] });
  const after = groupStatus(updated, ctx.now());
  await audit(ctx, actor, "group.joined", "group", id);
  if (after.currentPriceCents !== undefined && after.currentPriceCents !== before.currentPriceCents) {
    for (const m of updated.memberIds) {
      await notify(ctx, m, { kind: "offer", title: `Group price unlocked: ${formatMoney(after.currentPriceCents)}`, body: `${updated.title} reached ${after.members} members.`, href: `/app/groups/${id}`, potentialSavingsCents: after.currentSavingsPerMemberCents });
    }
  }
  return updated;
}

export async function leaveGroup(ctx: Ctx, actor: Actor, id: string) {
  const g = await ctx.store.get("groups", id);
  if (!g) throw new NotFoundError("Group");
  if (!g.memberIds.includes(actor.userId)) throw new ValidationError("You're not a member");
  await ctx.store.update("groups", id, { memberIds: g.memberIds.filter((m) => m !== actor.userId) });
  await audit(ctx, actor, "group.left", "group", id);
}

/** DEMO ONLY: add placeholder members so higher tiers can be demonstrated. */
export async function simulateGroupGrowth(ctx: Ctx, actor: Actor, id: string, count: number) {
  const g = await ctx.store.get("groups", id);
  if (!g) throw new NotFoundError("Group");
  if (!g.isSimulated) throw new ValidationError("Only simulated groups can be grown for demos");
  const n = Math.max(1, Math.min(50, Math.floor(count)));
  await ctx.store.update("groups", id, { simulatedMemberCount: g.simulatedMemberCount + n });
  await audit(ctx, actor, "group.simulated_growth", "group", id, { added: n });
}

/** Member takes up the group deal at the currently unlocked tier price. */
export async function takeUpGroupDeal(ctx: Ctx, actor: Actor, id: string, confirmed: boolean) {
  requireRole(actor, "customer");
  if (!confirmed) throw new ValidationError("Please confirm");
  const g = await ctx.store.get("groups", id);
  if (!g) throw new NotFoundError("Group");
  if (!g.memberIds.includes(actor.userId)) throw new ValidationError("Join the group first");
  const s = groupStatus(g, ctx.now());
  if (!s.bestOffer || s.currentPriceCents === undefined) throw new ValidationError("No tier is unlocked yet");
  const existing = (await ctx.store.list("transactions", { customerId: actor.userId })).find((t) => t.groupId === id && t.status !== "cancelled");
  if (existing) throw new ValidationError("You've already taken up this deal");
  const business = (await ctx.store.get("businesses", s.bestOffer.businessId))!;
  const now = ctx.now().toISOString();
  const n: Negotiation = {
    id: newId(), customerId: actor.userId, categoryId: g.categoryId, title: `${g.title} — group deal`, businessId: business.id, counterpartyName: business.name,
    mode: "approval", state: "open", baselineCents: g.baselineCents, targetCents: s.currentPriceCents, currentOfferCents: s.currentPriceCents,
    recurrence: g.recurrence, simulated: s.bestOffer.isSimulated, groupId: id, version: 0, createdAt: now, updatedAt: now, messages: [],
  };
  await ctx.store.insert("negotiations", n);
  await audit(ctx, actor, "group.deal_taken", "group", id, { priceCents: s.currentPriceCents });
  // The business pre-approved these terms when a person published the group offer.
  await proposeFinalTerms(ctx, n, {
    by: "customer", userId: actor.userId, priceCents: s.currentPriceCents,
    businessApproval: s.bestOffer.isSimulated ? "simulated" : "pre_approved",
    messages: [{ id: newId(), at: now, from: "customer", kind: "decision", amountCents: s.currentPriceCents, body: `You took up the group price of ${formatMoney(s.currentPriceCents)} (${s.members} members).` }],
  });
  return (await ctx.store.list("transactions", { negotiationId: n.id }))[0];
}

export async function submitGroupOffer(ctx: Ctx, actor: Actor, groupId: string, input: { tiers: PriceTier[]; terms: string; validDays: number }) {
  const b = await myBusiness(ctx, actor);
  const g = await ctx.store.get("groups", groupId);
  if (!g) throw new NotFoundError("Group");
  if (!b.categories.includes(g.categoryId)) throw new ValidationError("This group isn't in one of your service categories");
  if (!b.regions.includes(g.region) && !b.regions.includes("Australia-wide")) throw new ValidationError("This group is outside your service area");
  const err = validateTiers(input.tiers);
  if (err) throw new ValidationError(err);
  if (input.tiers.some((t) => t.priceCents >= g.baselineCents)) throw new ValidationError(`Every tier must be below the group's current price of ${formatMoney(g.baselineCents)}`);
  if (!Number.isInteger(input.validDays) || input.validDays < 1 || input.validDays > 90) throw new ValidationError("Validity must be 1–90 days");
  const offer: GroupOffer = {
    id: newId(), businessId: b.id, tiers: [...input.tiers].sort((a, c) => a.minMembers - c.minMembers), terms: input.terms.trim().slice(0, 1000),
    validUntil: new Date(ctx.now().getTime() + input.validDays * 86_400_000).toISOString(), approvedByUserId: actor.userId, isSimulated: false, createdAt: ctx.now().toISOString(),
  };
  await ctx.store.update("groups", groupId, { offers: [...g.offers.filter((o) => o.businessId !== b.id), offer], status: "offer_available" });
  for (const m of g.memberIds) await notify(ctx, m, { kind: "offer", title: `New group offer from ${b.name}`, body: g.title, href: `/app/groups/${groupId}` });
  await audit(ctx, actor, "group.offer_submitted", "group", groupId, { tiers: offer.tiers });
  return offer;
}

export async function listGroupsForBusiness(ctx: Ctx, actor: Actor) {
  const b = await myBusiness(ctx, actor);
  return (await listGroups(ctx)).filter(({ group }) => b.categories.includes(group.categoryId) && (b.regions.includes(group.region) || b.regions.includes("Australia-wide")))
    .map((x) => ({ ...x, myOffer: x.group.offers.find((o) => o.businessId === b.id), group: { ...x.group, memberIds: [] } }));
}
