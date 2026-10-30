import "server-only";
import sharp from "sharp";

export const VISION_MAX_BYTES = 15 * 1024 * 1024;
const MAX_EDGE = 2048;
const MIN_EDGE = 200;

export type PreparedImage = { bytes: Buffer; width: number; height: number };
export type PrepareResult = { ok: true; image: PreparedImage } | { ok: false; error: string };

function sniffImage(bytes: Uint8Array): "jpeg" | "png" | "webp" | null {
  const starts = (sig: number[], at = 0) => sig.every((b, i) => bytes[at + i] === b);
  if (starts([0xff, 0xd8, 0xff])) return "jpeg";
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return "webp"; // RIFF....WEBP
  return null;
}

/**
 * Validates and re-encodes an uploaded photo. Re-encoding drops all metadata (EXIF, including GPS
 * location and camera serials) after applying the orientation tag, caps the size, and means we
 * never store or serve the user's original bytes.
 */
export async function prepareSource(bytes: Uint8Array): Promise<PrepareResult> {
  if (bytes.byteLength === 0) return { ok: false, error: "Choose a photo to upload." };
  if (bytes.byteLength > VISION_MAX_BYTES) return { ok: false, error: "Photos must be 15 MB or smaller." };
  if (!sniffImage(bytes)) return { ok: false, error: "Upload a JPG, PNG or WebP photo." };
  try {
    const { data, info } = await sharp(bytes, { limitInputPixels: 50_000_000 })
      .rotate()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    if (info.width < MIN_EDGE || info.height < MIN_EDGE) return { ok: false, error: "That photo is too small. Use one at least 200 pixels wide and tall." };
    return { ok: true, image: { bytes: data, width: info.width, height: info.height } };
  } catch {
    return { ok: false, error: "We couldn't read that photo. Try a different file." };
  }
}

const escapeXml = (s: string) => s.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Stamps the AI CONCEPT mark (§5). Applied by SitePilot after any provider returns, so the mark
 * never depends on the provider, and every stored output carries it.
 */
export async function watermark(bytes: Uint8Array): Promise<Buffer> {
  const img = sharp(bytes);
  const { width = 1024, height = 768 } = await img.metadata();
  const band = Math.max(28, Math.round(height * 0.07));
  const font = Math.round(band * 0.5);
  const label = escapeXml("AI CONCEPT · illustration only · not a plan or approval");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect x="0" y="${height - band}" width="${width}" height="${band}" fill="#0f172a" fill-opacity="0.72"/>
    <text x="${Math.round(band * 0.4)}" y="${height - Math.round(band * 0.32)}" font-family="DejaVu Sans, Arial, sans-serif" font-size="${font}" font-weight="700" fill="#ffffff">${label}</text>
    <text x="${width - Math.round(band * 0.4)}" y="${Math.round(band * 0.9)}" text-anchor="end" font-family="DejaVu Sans, Arial, sans-serif" font-size="${font}" font-weight="800" fill="#ffffff" fill-opacity="0.8" stroke="#0f172a" stroke-opacity="0.4" stroke-width="1">AI CONCEPT</text>
  </svg>`;
  return img.composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).jpeg({ quality: 85, mozjpeg: true }).toBuffer();
}
