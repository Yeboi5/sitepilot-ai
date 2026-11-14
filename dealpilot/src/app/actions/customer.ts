"use server";

import { requireUser } from "@/lib/auth/session";
import { getCategory } from "@/lib/domain/categories";
import { ValidationError } from "@/lib/domain/permissions";
import type { PermissionMode, Recurrence, StoredDocument, VerificationMethod, WatchKind } from "@/lib/domain/types";
import { updateSettings } from "@/lib/services/accounts";
import { appCtx } from "@/lib/services/app-context";
import { confirmExtraction, uploadDocument } from "@/lib/services/documents";
import { joinGroup, leaveGroup, simulateGroupGrowth, takeUpGroupDeal } from "@/lib/services/groups";
import { cancelRequest, createRequest } from "@/lib/services/marketplace";
import {
  addExpense, addPricePoint, claimPriceAdjustment, createWatch, importExpensesCsv, markAlertRead, removeWatch, simulateFeedTick,
} from "@/lib/services/monitoring";
import {
  acceptCurrentOffer, approveDraft, approveFinalTerms, discardDraft, prepareNextAction, recordExternalReply, setNegotiationMode, setTarget, startExternalNegotiation,
  startOfferNegotiation, walkAway,
} from "@/lib/services/negotiations";
import { acceptOfferDirectly, cancelTransaction, verifyTransaction } from "@/lib/services/transactions";
import { act, int, money, optionalMoney, str } from "./helpers";

const RECURRENCES: Recurrence[] = ["one_off", "weekly", "monthly", "quarterly", "annual"];
const recurrence = (v: string): Recurrence => (RECURRENCES.includes(v as Recurrence) ? (v as Recurrence) : "one_off");
const MODES: PermissionMode[] = ["advisory", "approval", "autopilot"];

async function customer() {
  const { actor } = await requireUser("customer");
  return { actor, ctx: await appCtx() };
}

// ─── Documents ──────────────────────────────────────────────────────────────

export async function uploadDocumentAction(fd: FormData) {
  const { actor, ctx } = await customer();
  await act(async () => {
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) throw new ValidationError("Choose a file to upload");
    return uploadDocument(ctx, actor, {
      filename: file.name, mimeType: file.type || "application/octet-stream", data: new Uint8Array(await file.arrayBuffer()),
      categoryId: str(fd, "categoryId"), kind: (str(fd, "kind") || "other") as StoredDocument["kind"], statedAmountCents: optionalMoney(fd, "statedAmount"),
    });
  }, (d) => `/app/documents/${d.id}`, "/app/documents", "Uploaded and analysed");
}

export async function confirmExtractionAction(fd: FormData) {
  const { actor, ctx } = await customer();
  const id = str(fd, "id");
  await act(async () => {
    const lineItems: { description: string; amountCents: number }[] = [];
    for (let i = 0; i < 50; i++) {
      const d = str(fd, `li_desc_${i}`);
      if (!d && !str(fd, `li_amt_${i}`)) continue;
      lineItems.push({ description: d, amountCents: money(fd, `li_amt_${i}`, "line item amount") });
    }
    return confirmExtraction(ctx, actor, id, { vendor: str(fd, "vendor"), totalCents: optionalMoney(fd, "total"), recurrence: recurrence(str(fd, "recurrence")), lineItems, notes: str(fd, "notes") });
  }, () => `/app/documents/${id}`, `/app/documents/${id}`, "Details confirmed");
}

export async function approveTermsAction(fd: FormData) {
  const { actor, ctx } = await customer();
  await act(() => approveFinalTerms(ctx, actor, str(fd, "id"), fd.get("confirm") === "on"), () => negPath(fd), negPath(fd), "Final terms approved");
}

// ─── Requests & offers ──────────────────────────────────────────────────────

export async function createRequestAction(fd: FormData) {
  const { actor, ctx } = await customer();
  const categoryId = str(fd, "categoryId");
  await act(async () => {
    const category = getCategory(categoryId);
    const fields: Record<string, unknown> = {};
    for (const f of category.fields) fields[f.key] = fd.get(`f_${f.key}`) ?? undefined;
    return createRequest(ctx, actor, {
      categoryId, title: str(fd, "title"), description: str(fd, "description"), region: str(fd, "region"), baselineCents: money(fd, "baseline", "current price"),
      recurrence: recurrence(str(fd, "recurrence")), fields, documentId: str(fd, "documentId") || undefined, simulateBids: fd.get("simulateBids") === "on",
    });
  }, (r) => `/app/requests/${r.id}`, `/app/requests/new?category=${encodeURIComponent(categoryId)}`, "Request created");
}

export async function cancelRequestAction(fd: FormData) {
  const { actor, ctx } = await customer();
  const id = str(fd, "id");
  await act(() => cancelRequest(ctx, actor, id), () => "/app/requests", `/app/requests/${id}`, "Request cancelled");
}

export async function negotiateOfferAction(fd: FormData) {
  const { actor, ctx } = await customer();
  await act(() => startOfferNegotiation(ctx, actor, str(fd, "offerId")), (n) => `/app/negotiations/${n.id}`, `/app/requests/${str(fd, "requestId")}`);
}

export async function acceptOfferAction(fd: FormData) {
  const { actor, ctx } = await customer();
  await act(() => acceptOfferDirectly(ctx, actor, str(fd, "offerId"), fd.get("confirm") === "on"), (n) => `/app/negotiations/${n.id}`, `/app/requests/${str(fd, "requestId")}`, "Offer accepted — waiting for the business to approve the final terms");
}

// ─── Negotiations ───────────────────────────────────────────────────────────

export async function startNegotiationAction(fd: FormData) {
  const { actor, ctx } = await customer();
  await act(() => startExternalNegotiation(ctx, actor, {
    categoryId: str(fd, "categoryId"), title: str(fd, "title"), counterpartyName: str(fd, "counterparty"), baselineCents: money(fd, "baseline", "current price"),
    recurrence: recurrence(str(fd, "recurrence")), targetCents: optionalMoney(fd, "target"), mode: MODES.includes(str(fd, "mode") as PermissionMode) ? (str(fd, "mode") as PermissionMode) : undefined,
    documentId: str(fd, "documentId") || undefined,
  }), (n) => `/app/negotiations/${n.id}`, "/app/negotiations/new");
}

const negPath = (fd: FormData) => `/app/negotiations/${str(fd, "id")}`;

export async function prepareActionAction(fd: FormData) {
  const { actor, ctx } = await customer();
  await act(() => prepareNextAction(ctx, actor, str(fd, "id")), () => negPath(fd), negPath(fd));
}

export async function approveDraftAction(fd: FormData) {
  const { actor, ctx } = await customer();
  if (fd.get("confirm") !== "on") return act(async () => { throw new ValidationError("Tick the box to confirm you approve this message"); }, () => "", negPath(fd));
  await act(() => approveDraft(ctx, actor, str(fd, "id"), str(fd, "messageId"), str(fd, "body")), () => negPath(fd), negPath(fd), "Approved and sent");
}

export async function discardDraftAction(fd: FormData) {
  const { actor, ctx } = await customer();
  await act(() => discardDraft(ctx, actor, str(fd, "id")), () => negPath(fd), negPath(fd));
}

export async function acceptNegotiationAction(fd: FormData) {
  const { actor, ctx } = await customer();
  await act(() => acceptCurrentOffer(ctx, actor, str(fd, "id"), fd.get("confirm") === "on"), () => negPath(fd), negPath(fd), "Accepted — final terms recorded");
}

export async function walkAwayAction(fd: FormData) {
  const { actor, ctx } = await customer();
  await act(() => walkAway(ctx, actor, str(fd, "id")), () => negPath(fd), negPath(fd), "Negotiation ended. No fee applies.");
}

export async function recordReplyAction(fd: FormData) {
  const { actor, ctx } = await customer();
  await act(() => recordExternalReply(ctx, actor, str(fd, "id"), money(fd, "amount"), str(fd, "note")), () => negPath(fd), negPath(fd));
}

export async function setModeAction(fd: FormData) {
  const { actor, ctx } = await customer();
  const mode = str(fd, "mode") as PermissionMode;
  await act(async () => {
    if (!MODES.includes(mode)) throw new ValidationError("Invalid mode");
    return setNegotiationMode(ctx, actor, str(fd, "id"), mode);
  }, () => negPath(fd), negPath(fd));
}

export async function setTargetAction(fd: FormData) {
  const { actor, ctx } = await customer();
  await act(() => setTarget(ctx, actor, str(fd, "id"), money(fd, "target", "target")), () => negPath(fd), negPath(fd), "Target updated");
}

// ─── Transactions ───────────────────────────────────────────────────────────

const METHODS: VerificationMethod[] = ["customer_confirmed_invoice", "document_match"];

export async function verifyTransactionAction(fd: FormData) {
  const { actor, ctx } = await customer();
  const back = str(fd, "back") || "/app/savings";
  await act(() => verifyTransaction(ctx, actor, str(fd, "txId"), {
    method: str(fd, "evidenceDocumentId") ? "document_match" : METHODS[0], finalCents: money(fd, "finalAmount", "final amount"),
    evidenceDocumentId: str(fd, "evidenceDocumentId") || undefined, confirmed: fd.get("confirm") === "on",
  }), () => back, back, "Saving verified");
}

export async function cancelTransactionAction(fd: FormData) {
  const { actor, ctx } = await customer();
  const back = str(fd, "back") || "/app/savings";
  await act(() => cancelTransaction(ctx, actor, str(fd, "txId"), str(fd, "reason")), () => back, back, "Marked as not going ahead. No fee.");
}

// ─── Groups ─────────────────────────────────────────────────────────────────

const grpPath = (fd: FormData) => `/app/groups/${str(fd, "id")}`;
export async function joinGroupAction(fd: FormData) {
  const { actor, ctx } = await customer();
  await act(() => joinGroup(ctx, actor, str(fd, "id")), () => grpPath(fd), grpPath(fd), "You joined the group");
}
export async function leaveGroupAction(fd: FormData) {
  const { actor, ctx } = await customer();
  await act(() => leaveGroup(ctx, actor, str(fd, "id")), () => grpPath(fd), grpPath(fd), "You left the group");
}
export async function growGroupAction(fd: FormData) {
  const { actor, ctx } = await customer();
  await act(() => simulateGroupGrowth(ctx, actor, str(fd, "id"), int(fd, "count", 5)), () => grpPath(fd), grpPath(fd), "Simulated members added");
}
export async function takeUpGroupAction(fd: FormData) {
  const { actor, ctx } = await customer();
  await act(() => takeUpGroupDeal(ctx, actor, str(fd, "id"), fd.get("confirm") === "on"), () => "/app/savings", grpPath(fd), "Group deal taken up — verify once complete");
}

// ─── Monitoring & guardian ──────────────────────────────────────────────────

export async function createWatchAction(fd: FormData) {
  const { actor, ctx } = await customer();
  await act(() => createWatch(ctx, actor, {
    kind: (str(fd, "kind") || "retail_product") as WatchKind, label: str(fd, "label"), merchant: str(fd, "merchant"), categoryId: str(fd, "categoryId"),
    priceCents: money(fd, "price", "price"), targetPriceCents: optionalMoney(fd, "target"), adjustmentWindowDays: int(fd, "window") || undefined,
    renewalDate: str(fd, "renewalDate") ? new Date(str(fd, "renewalDate")).toISOString() : undefined,
  }), () => "/app/monitor", "/app/monitor", "Now monitoring");
}
export async function addPriceAction(fd: FormData) {
  const { actor, ctx } = await customer();
  await act(() => addPricePoint(ctx, actor, str(fd, "id"), money(fd, "price", "price")), () => "/app/monitor", "/app/monitor", "Price recorded");
}
export async function simulateFeedAction(fd: FormData) {
  const { actor, ctx } = await customer();
  await act(() => simulateFeedTick(ctx, actor, str(fd, "id")), () => `/app/monitor#${str(fd, "id")}`, "/app/monitor", "Simulated feed update received");
}
export async function claimAdjustmentAction(fd: FormData) {
  const { actor, ctx } = await customer();
  await act(() => claimPriceAdjustment(ctx, actor, str(fd, "id")), (n) => `/app/negotiations/${n.id}`, "/app/monitor");
}
export async function removeWatchAction(fd: FormData) {
  const { actor, ctx } = await customer();
  await act(() => removeWatch(ctx, actor, str(fd, "id")), () => "/app/monitor", "/app/monitor", "Stopped monitoring");
}
export async function markAlertReadAction(fd: FormData) {
  const { actor, ctx } = await customer();
  await act(() => markAlertRead(ctx, actor, str(fd, "id")), () => str(fd, "back") || "/app", "/app");
}
export async function importCsvAction(fd: FormData) {
  const { actor, ctx } = await customer();
  await act(async () => {
    const file = fd.get("file");
    const text = file instanceof File && file.size ? await file.text() : str(fd, "csv");
    if (!text) throw new ValidationError("Choose a CSV file or paste rows");
    const r = await importExpensesCsv(ctx, actor, text);
    return r;
  }, (r) => `/app/guardian?notice=${encodeURIComponent(`Imported ${r.imported} rows${r.errors.length ? `, skipped ${r.errors.length}` : ""}`)}`, "/app/guardian");
}
export async function addExpenseAction(fd: FormData) {
  const { actor, ctx } = await customer();
  await act(() => addExpense(ctx, actor, { date: str(fd, "date"), merchant: str(fd, "merchant"), amountCents: money(fd, "amount") }), () => "/app/guardian", "/app/guardian", "Expense added");
}

// ─── Settings ───────────────────────────────────────────────────────────────

export async function updateSettingsAction(fd: FormData) {
  const { actor, ctx } = await customer();
  await act(() => updateSettings(ctx, actor, {
    permissionMode: str(fd, "mode") as PermissionMode, autopilotLimitCents: optionalMoney(fd, "limit") ?? 0, region: str(fd, "region"),
  }), () => "/app/settings", "/app/settings", "Settings saved");
}
