import type { Cents } from "./money";
import type { GroupOffer, PriceTier, PurchasingGroup, User } from "./types";

export function tierFor(tiers: PriceTier[], members: number): PriceTier | undefined {
  return [...tiers].sort((a, b) => b.minMembers - a.minMembers).find((t) => members >= t.minMembers);
}

export function nextTier(tiers: PriceTier[], members: number): PriceTier | undefined {
  return [...tiers].sort((a, b) => a.minMembers - b.minMembers).find((t) => t.minMembers > members);
}

export interface GroupStatus {
  members: number;
  bestOffer?: GroupOffer;
  currentPriceCents?: Cents;
  currentSavingsPerMemberCents: Cents;
  next?: { tier: PriceTier; membersNeeded: number; savingsPerMemberCents: Cents };
  expired: boolean;
  daysLeft: number;
}

export function groupStatus(g: PurchasingGroup, now = new Date()): GroupStatus {
  const members = g.memberIds.length + g.simulatedMemberCount;
  const expiry = new Date(g.expiresAt);
  const expired = expiry < now;
  const daysLeft = Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / 86_400_000));
  const live = g.offers.filter((o) => new Date(o.validUntil) >= now);
  let bestOffer: GroupOffer | undefined;
  let currentPrice: Cents | undefined;
  for (const o of live) {
    const t = tierFor(o.tiers, members);
    if (t && (currentPrice === undefined || t.priceCents < currentPrice)) { currentPrice = t.priceCents; bestOffer = o; }
  }
  let next: GroupStatus["next"];
  for (const o of live) {
    const t = nextTier(o.tiers, members);
    if (t && (!next || t.priceCents < next.tier.priceCents)) {
      next = { tier: t, membersNeeded: t.minMembers - members, savingsPerMemberCents: Math.max(0, g.baselineCents - t.priceCents) };
    }
  }
  return {
    members,
    bestOffer,
    currentPriceCents: currentPrice,
    currentSavingsPerMemberCents: currentPrice !== undefined ? Math.max(0, g.baselineCents - currentPrice) : 0,
    next,
    expired,
    daysLeft,
  };
}

export function checkEligibility(g: PurchasingGroup, user: Pick<User, "id" | "region" | "role">, now = new Date()): { eligible: boolean; reason: string } {
  if (user.role !== "customer") return { eligible: false, reason: "Only customer accounts can join purchasing groups" };
  if (g.status === "closed" || new Date(g.expiresAt) < now) return { eligible: false, reason: "This group has closed" };
  if (g.memberIds.includes(user.id)) return { eligible: false, reason: "You are already a member" };
  if (g.region !== "Australia-wide" && g.region !== user.region) return { eligible: false, reason: `This group is limited to ${g.region}` };
  return { eligible: true, reason: "You meet the eligibility criteria" };
}

export function validateTiers(tiers: PriceTier[]): string | null {
  if (tiers.length === 0) return "Add at least one price tier";
  const sorted = [...tiers].sort((a, b) => a.minMembers - b.minMembers);
  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i];
    if (!Number.isInteger(t.minMembers) || t.minMembers < 2) return "Tiers need at least 2 members";
    if (!Number.isInteger(t.priceCents) || t.priceCents <= 0) return "Tier prices must be positive";
    if (i > 0 && (t.minMembers === sorted[i - 1].minMembers || t.priceCents >= sorted[i - 1].priceCents)) {
      return "Larger tiers must have strictly lower prices";
    }
  }
  return null;
}
