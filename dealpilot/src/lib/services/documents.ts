import { getCategory, isCategory } from "../domain/categories";
import { ForbiddenError, NotFoundError, requireRole, ValidationError } from "../domain/permissions";
import type { Actor, Recurrence, StoredDocument } from "../domain/types";
import { MockAIProvider } from "../ai/mock";
import { builtinScanner } from "../integrations/scanner";
import { audit, newId, type Ctx } from "./context";
import { enforceRateLimit } from "./rate-limit";

const offlineAnalyser = new MockAIProvider();

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "text/plain": "txt",
  "text/csv": "csv",
};

/** Checks magic bytes so a renamed executable can't masquerade as a PDF or image. */
export function sniffMatches(mimeType: string, data: Uint8Array): boolean {
  const starts = (...b: number[]) => b.every((v, i) => data[i] === v);
  switch (mimeType) {
    case "application/pdf": return starts(0x25, 0x50, 0x44, 0x46);
    case "image/png": return starts(0x89, 0x50, 0x4e, 0x47);
    case "image/jpeg": return starts(0xff, 0xd8, 0xff);
    case "image/webp": return starts(0x52, 0x49, 0x46, 0x46);
    case "text/plain":
    case "text/csv": return !data.slice(0, 1024).includes(0);
    default: return false;
  }
}

export interface UploadInput {
  filename: string;
  mimeType: string;
  data: Uint8Array;
  categoryId: string;
  kind: StoredDocument["kind"];
  statedAmountCents?: number;
}

export class InfectedFileError extends ValidationError {
  constructor() { super("This file was blocked by our malware scan and was not stored."); }
}

/**
 * The single upload path for every role: validation, rate limit, malware scan (fail-closed),
 * private owner-scoped storage, then (optionally) AI analysis.
 */
export async function storeDocument(ctx: Ctx, actor: Actor, input: UploadInput, opts: { analyse: boolean }): Promise<StoredDocument> {
  if (!isCategory(input.categoryId)) throw new ValidationError("Choose a category");
  if (!ALLOWED_TYPES[input.mimeType]) throw new ValidationError("Upload a PDF, PNG, JPG, WEBP, TXT or CSV file");
  if (input.data.length === 0) throw new ValidationError("The file is empty");
  if (input.data.length > MAX_UPLOAD_BYTES) throw new ValidationError("Files must be 8 MB or smaller");
  if (!sniffMatches(input.mimeType, input.data)) throw new ValidationError("The file contents don't match its type");
  await enforceRateLimit(ctx, "upload", `user:${actor.userId}`);

  // Scan BEFORE anything is stored. If the scanner fails, the upload fails (fail closed).
  const scanner = ctx.scanner ?? builtinScanner;
  let scan;
  try {
    scan = await scanner.scan(input.data);
  } catch (e) {
    await audit(ctx, actor, "document.scan_error", "document", "-", { engine: scanner.name, error: e instanceof Error ? e.message : "unknown" });
    throw new ValidationError("We couldn't scan this file for malware right now, so it wasn't stored. Please try again later.");
  }
  if (!scan.clean) {
    await audit(ctx, actor, "document.blocked_infected", "document", "-", { engine: scan.engine, signature: scan.signature });
    throw new InfectedFileError();
  }

  const id = newId();
  const filename = input.filename.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || `document.${ALLOWED_TYPES[input.mimeType]}`;
  // Private, owner-scoped key. Never served publicly; see /api/documents/[id].
  const storageKey = `${actor.userId}/${id}`;
  await ctx.store.putBlob(storageKey, input.data, input.mimeType);

  let analysis: StoredDocument["analysis"];
  if (opts.analyse) {
    const user = await ctx.store.get("users", actor.userId);
    const category = getCategory(input.categoryId);
    const args = { filename, mimeType: input.mimeType, data: input.data, category, statedAmountCents: input.statedAmountCents };
    // Documents go to an external AI provider only with the customer's consent.
    if (ctx.ai.simulated || user?.aiProcessingConsent) {
      await enforceRateLimit(ctx, "aiCall", `user:${actor.userId}`);
      analysis = await ctx.ai.analyseDocument(args);
    } else {
      analysis = await offlineAnalyser.analyseDocument(args);
      analysis.summary = `${analysis.summary} (Analysed on DealPilot's servers only — turn on AI document analysis in AI permissions to use the full AI provider.)`;
    }
  }
  const doc: StoredDocument = {
    id, ownerId: actor.userId, filename, mimeType: input.mimeType, sizeBytes: input.data.length, categoryId: input.categoryId,
    kind: input.kind, storageKey, analysis, scanStatus: "clean", scanEngine: scan.engine, scannedAt: ctx.now().toISOString(), isDemo: false, uploadedAt: ctx.now().toISOString(),
  };
  await ctx.store.insert("documents", doc);
  await audit(ctx, actor, "document.uploaded", "document", id, { kind: input.kind, provider: analysis?.provider, scanEngine: scan.engine });
  return doc;
}

export async function uploadDocument(ctx: Ctx, actor: Actor, input: UploadInput): Promise<StoredDocument> {
  requireRole(actor, "customer");
  return storeDocument(ctx, actor, input, { analyse: true });
}

export async function listDocuments(ctx: Ctx, actor: Actor) {
  const docs = await ctx.store.list("documents", { ownerId: actor.userId });
  return docs.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export async function getDocument(ctx: Ctx, actor: Actor, id: string): Promise<StoredDocument> {
  const doc = await ctx.store.get("documents", id);
  if (!doc) throw new NotFoundError("Document");
  if (doc.ownerId !== actor.userId && actor.role !== "admin") throw new ForbiddenError();
  return doc;
}

export async function getDocumentFile(ctx: Ctx, actor: Actor, id: string) {
  const doc = await getDocument(ctx, actor, id);
  const blob = await ctx.store.getBlob(doc.storageKey);
  if (!blob) throw new NotFoundError("File");
  await audit(ctx, actor, "document.downloaded", "document", id);
  return { doc, blob };
}

export interface ConfirmExtractionInput {
  vendor?: string;
  totalCents?: number;
  recurrence: Recurrence;
  lineItems: { description: string; amountCents: number }[];
  notes?: string;
}

/**
 * The customer reviews what the AI extracted and corrects it. Only these confirmed values are
 * used for requests and negotiations; the raw AI output is kept for audit.
 */
export async function confirmExtraction(ctx: Ctx, actor: Actor, id: string, input: ConfirmExtractionInput): Promise<StoredDocument> {
  const doc = await getDocument(ctx, actor, id);
  if (doc.ownerId !== actor.userId) throw new ForbiddenError();
  if (input.totalCents !== undefined && (!Number.isInteger(input.totalCents) || input.totalCents <= 0)) throw new ValidationError("Total must be a positive amount");
  const lineItems = input.lineItems
    .filter((l) => l.description.trim() && Number.isInteger(l.amountCents) && l.amountCents >= 0)
    .slice(0, 50)
    .map((l) => ({ description: l.description.trim().slice(0, 200), amountCents: l.amountCents }));
  const confirmed = { vendor: input.vendor?.trim().slice(0, 120) || undefined, totalCents: input.totalCents, recurrence: input.recurrence, lineItems, notes: input.notes?.trim().slice(0, 1000) || undefined };
  const changed = JSON.stringify({ v: doc.analysis?.vendor, t: doc.analysis?.totalCents, r: doc.analysis?.recurrence }) !== JSON.stringify({ v: confirmed.vendor, t: confirmed.totalCents, r: confirmed.recurrence });
  const updated = await ctx.store.update("documents", id, { confirmed, confirmedAt: ctx.now().toISOString() });
  await audit(ctx, actor, "document.extraction_confirmed", "document", id, { correctedByCustomer: changed });
  return updated;
}
