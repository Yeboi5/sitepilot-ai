"use server";

import { requireUser } from "@/lib/auth/session";
import { ValidationError } from "@/lib/domain/permissions";
import type { PriceTier } from "@/lib/domain/types";
import { updateBusinessProfile } from "@/lib/services/accounts";
import { appCtx } from "@/lib/services/app-context";
import { submitGroupOffer } from "@/lib/services/groups";
import { submitOffer, withdrawOffer } from "@/lib/services/marketplace";
import { approveFinalTerms, businessRespond } from "@/lib/services/negotiations";
import { act, int, money, optionalMoney, str } from "./helpers";

async function business() {
  const { actor } = await requireUser("business");
  return { actor, ctx: await appCtx() };
}

export async function submitOfferAction(fd: FormData) {
  const { actor, ctx } = await business();
  const id = str(fd, "requestId");
  if (fd.get("approve") !== "on") {
    return act(async () => { throw new ValidationError("Tick the box to confirm a person at your business has reviewed and approves this offer"); }, () => "", `/biz/requests/${id}`);
  }
  await act(() => submitOffer(ctx, actor, id, {
    priceCents: money(fd, "price", "price"), scope: str(fd, "scope"), materials: str(fd, "materials"), warrantyMonths: int(fd, "warranty"),
    completionDays: int(fd, "days"), includesInsurance: fd.get("insurance") === "on", validDays: int(fd, "validDays", 14), aiDrafted: str(fd, "aiDrafted") === "1",
  }), () => `/biz/requests/${id}`, `/biz/requests/${id}`, "Offer submitted to the customer");
}

export async function withdrawOfferAction(fd: FormData) {
  const { actor, ctx } = await business();
  await act(() => withdrawOffer(ctx, actor, str(fd, "offerId")), () => `/biz/requests/${str(fd, "requestId")}`, `/biz/requests/${str(fd, "requestId")}`, "Offer withdrawn");
}

export async function respondAction(fd: FormData) {
  const { actor, ctx } = await business();
  const id = str(fd, "id");
  const action = str(fd, "action") as "counter" | "accept" | "decline";
  await act(async () => {
    if (!["counter", "accept", "decline"].includes(action)) throw new ValidationError("Choose a response");
    if (fd.get("approve") !== "on") throw new ValidationError("Tick the box to confirm you approve this response");
    return businessRespond(ctx, actor, id, { action, priceCents: action === "counter" ? optionalMoney(fd, "price") : undefined, message: str(fd, "message") });
  }, () => `/biz/inbox/${id}`, `/biz/inbox/${id}`, action === "counter" ? "Counteroffer sent" : action === "accept" ? "Accepted" : "Declined");
}

export async function submitGroupOfferAction(fd: FormData) {
  const { actor, ctx } = await business();
  const id = str(fd, "groupId");
  await act(async () => {
    if (fd.get("approve") !== "on") throw new ValidationError("Tick the box to approve this volume offer");
    const tiers: PriceTier[] = [];
    for (const i of [1, 2, 3]) {
      const m = str(fd, `min${i}`);
      const p = str(fd, `price${i}`);
      if (m && p) tiers.push({ minMembers: int(fd, `min${i}`), priceCents: money(fd, `price${i}`, "tier price") });
    }
    return submitGroupOffer(ctx, actor, id, { tiers, terms: str(fd, "terms"), validDays: int(fd, "validDays", 14) });
  }, () => "/biz/groups", "/biz/groups", "Volume offer published to group members");
}

export async function updateProfileAction(fd: FormData) {
  const { actor, ctx } = await business();
  const list = (k: string) => str(fd, k).split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
  await act(() => updateBusinessProfile(ctx, actor, {
    name: str(fd, "name"), abn: str(fd, "abn"), description: str(fd, "description"), categories: fd.getAll("categories").map(String),
    regions: list("regions"), qualifications: list("qualifications"), licenceNumber: str(fd, "licence"), insured: fd.get("insured") === "on",
  }), () => "/biz/profile", "/biz/profile", "Profile saved");
}

/** AI drafts a bid; the draft is passed back to the form for a person to review. Nothing is sent. */
export async function draftBidAction(fd: FormData) {
  const { actor, ctx } = await business();
  const id = str(fd, "requestId");
  const { draftBidWithAI } = await import("@/lib/services/marketplace");
  await act(() => draftBidWithAI(ctx, actor, id), (d) => `/biz/requests/${id}?draft=${Buffer.from(JSON.stringify(d)).toString("base64url")}`, `/biz/requests/${id}`);
}

/** AI drafts a counteroffer for the business to review. Nothing is sent. */
export async function draftCounterAction(fd: FormData) {
  const { actor, ctx } = await business();
  const id = str(fd, "id");
  const { draftBusinessCounter } = await import("@/lib/services/negotiations");
  await act(() => draftBusinessCounter(ctx, actor, id, money(fd, "minimum", "lowest acceptable price")), (d) => `/biz/inbox/${id}?draft=${Buffer.from(JSON.stringify(d)).toString("base64url")}`, `/biz/inbox/${id}`);
}

export async function approveTermsBizAction(fd: FormData) {
  const { actor, ctx } = await business();
  const id = str(fd, "id");
  await act(() => approveFinalTerms(ctx, actor, id, fd.get("confirm") === "on"), () => `/biz/inbox/${id}`, `/biz/inbox/${id}`, "Final terms approved");
}
