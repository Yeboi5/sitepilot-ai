/**
 * Upload validation: decide a file's type from its first bytes (not its name or the browser's
 * claim), and enforce a size limit.
 */
export const EVIDENCE_MAX_BYTES = 10 * 1024 * 1024;

export type EvidenceType = { mime: "application/pdf" | "image/jpeg" | "image/png"; ext: "pdf" | "jpg" | "png" };

export function sniffEvidenceType(bytes: Uint8Array): EvidenceType | null {
  const starts = (sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (starts([0x25, 0x50, 0x44, 0x46, 0x2d])) return { mime: "application/pdf", ext: "pdf" }; // %PDF-
  if (starts([0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: "jpg" };
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: "image/png", ext: "png" };
  return null;
}

export type EvidenceCheck = { ok: true; type: EvidenceType } | { ok: false; error: string };

export function checkEvidence(bytes: Uint8Array): EvidenceCheck {
  if (bytes.byteLength === 0) return { ok: false, error: "Choose a file to upload." };
  if (bytes.byteLength > EVIDENCE_MAX_BYTES) return { ok: false, error: "Files must be 10 MB or smaller." };
  const type = sniffEvidenceType(bytes);
  if (!type) return { ok: false, error: "Upload a PDF, JPG or PNG." };
  return { ok: true, type };
}

/** Keep a readable, safe display name. */
export function safeFileName(name: string): string {
  const cleaned = name.replace(/[^\w.\- ]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 120);
  return cleaned || "evidence";
}
