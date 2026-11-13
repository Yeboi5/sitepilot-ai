import { getCategory, isCategory } from "../domain/categories";
import { ForbiddenError, NotFoundError, requireRole, ValidationError } from "../domain/permissions";
import type { Actor, StoredDocument } from "../domain/types";
import { audit, newId, type Ctx } from "./context";

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

export async function uploadDocument(ctx: Ctx, actor: Actor, input: UploadInput): Promise<StoredDocument> {
  requireRole(actor, "customer");
  if (!isCategory(input.categoryId)) throw new ValidationError("Choose a category");
  if (!ALLOWED_TYPES[input.mimeType]) throw new ValidationError("Upload a PDF, PNG, JPG, WEBP, TXT or CSV file");
  if (input.data.length === 0) throw new ValidationError("The file is empty");
  if (input.data.length > MAX_UPLOAD_BYTES) throw new ValidationError("Files must be 8 MB or smaller");
  if (!sniffMatches(input.mimeType, input.data)) throw new ValidationError("The file contents don't match its type");

  const id = newId();
  const filename = input.filename.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || `document.${ALLOWED_TYPES[input.mimeType]}`;
  // Private, owner-scoped key. Never served publicly; see /api/documents/[id].
  const storageKey = `${actor.userId}/${id}`;
  await ctx.store.putBlob(storageKey, input.data, input.mimeType);
  const analysis = await ctx.ai.analyseDocument({
    filename, mimeType: input.mimeType, data: input.data, category: getCategory(input.categoryId), statedAmountCents: input.statedAmountCents,
  });
  const doc: StoredDocument = {
    id, ownerId: actor.userId, filename, mimeType: input.mimeType, sizeBytes: input.data.length, categoryId: input.categoryId,
    kind: input.kind, storageKey, analysis, isDemo: false, uploadedAt: ctx.now().toISOString(),
  };
  await ctx.store.insert("documents", doc);
  await audit(ctx, actor, "document.uploaded", "document", id, { kind: input.kind, provider: analysis.provider });
  return doc;
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
