import "server-only";
import sharp from "sharp";
import { FLAGS } from "@/lib/flags";
import { presetLabel, styleLabel, type VisionMode, type VisionStyle } from "./presets";

export type VisionRequest = { image: Buffer; mode: VisionMode; preset: string; style: VisionStyle; prompt: string | null };
export type VisionResult = { image: Buffer; provider: string; model: string; costCents: number };

/**
 * Image-editing provider (limitation L3: Claude reads images but doesn't generate them). A real
 * provider is added only once one is chosen, contracted and reviewed for privacy; until then the
 * deterministic, offline mock below is used. Outputs are watermarked by the caller, not here.
 */
export interface VisionProvider {
  generate(req: VisionRequest): Promise<VisionResult>;
}

const PALETTE: Record<VisionStyle, { main: string; accent: string; tint: string }> = {
  modern: { main: "#64748b", accent: "#e2e8f0", tint: "#94a3b8" },
  coastal: { main: "#0ea5e9", accent: "#f8fafc", tint: "#7dd3fc" },
  classic: { main: "#b45309", accent: "#fef3c7", tint: "#d6a77a" },
  natural: { main: "#4d7c0f", accent: "#ecfccb", tint: "#a3b18a" },
};

/** One translucent shape per preset, in fractions of the image, so the effect is obvious. */
function overlay(preset: string, w: number, h: number, c: (typeof PALETTE)[VisionStyle]): string {
  const r = (x: number, y: number, rw: number, rh: number, fill: string, extra = "") =>
    `<rect x="${Math.round(x * w)}" y="${Math.round(y * h)}" width="${Math.round(rw * w)}" height="${Math.round(rh * h)}" rx="${Math.round(Math.min(w, h) * 0.02)}" fill="${fill}" fill-opacity="0.6" ${extra}/>`;
  const dashed = `stroke="${c.accent}" stroke-width="${Math.max(3, Math.round(w / 200))}" stroke-dasharray="14 10" fill="none"`;
  switch (preset) {
    case "pool":
      return r(0.35, 0.55, 0.3, 0.2, "#38bdf8", `stroke="${c.accent}" stroke-width="6"`);
    case "granny_flat":
      return r(0.62, 0.15, 0.28, 0.3, c.main, `stroke="${c.accent}" stroke-width="5"`);
    case "garden":
      return [0.2, 0.45, 0.7].map((x) => `<circle cx="${Math.round(x * w)}" cy="${Math.round(0.78 * h)}" r="${Math.round(0.08 * Math.min(w, h))}" fill="#65a30d" fill-opacity="0.6"/>`).join("");
    case "extension":
      return r(0.3, 0.08, 0.4, 0.18, c.main, `stroke="${c.accent}" stroke-width="5"`);
    case "driveway":
      return r(0.08, 0.5, 0.14, 0.5, "#9ca3af");
    case "subdivision_concept":
      return `<line x1="${Math.round(0.5 * w)}" y1="0" x2="${Math.round(0.5 * w)}" y2="${h}" ${dashed}/>`;
    case "facade":
      return r(0.15, 0.25, 0.7, 0.5, c.main);
    case "fence":
      return r(0, 0.78, 1, 0.12, c.main);
    case "roof":
      return r(0.1, 0.05, 0.8, 0.22, c.main);
    case "kitchen":
      return r(0.1, 0.62, 0.8, 0.16, c.main, `stroke="${c.accent}" stroke-width="5"`);
    case "bathroom":
      return r(0.55, 0.2, 0.35, 0.55, c.accent, `stroke="${c.main}" stroke-width="5"`);
    case "layout":
      return `<rect x="${Math.round(0.08 * w)}" y="${Math.round(0.15 * h)}" width="${Math.round(0.84 * w)}" height="${Math.round(0.65 * h)}" ${dashed}/>`;
    default:
      return "";
  }
}

export const mockProvider: VisionProvider = {
  async generate({ image, preset, style, mode }) {
    const img = sharp(image);
    const { width = 1024, height = 768 } = await img.metadata();
    const c = PALETTE[style];
    const font = Math.max(14, Math.round(Math.min(width, height) * 0.035));
    const label = `Mock preview: ${presetLabel(mode, preset)} · ${styleLabel(style)}`.replace(/[<>&'"]/g, "");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="${width}" height="${height}" fill="${c.tint}" fill-opacity="0.18"/>
      ${overlay(preset, width, height, c)}
      <rect x="${font}" y="${font}" width="${Math.round(label.length * font * 0.6) + font}" height="${Math.round(font * 1.8)}" rx="${Math.round(font * 0.9)}" fill="#ffffff" fill-opacity="0.9"/>
      <text x="${Math.round(font * 1.5)}" y="${Math.round(font * 2.25)}" font-family="DejaVu Sans, Arial, sans-serif" font-size="${font}" font-weight="700" fill="#0f172a">${label}</text>
    </svg>`;
    const out = await img.composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).jpeg({ quality: 85 }).toBuffer();
    return { image: out, provider: "mock", model: "mock-1", costCents: 0 };
  },
};

export function visionProvider(): VisionProvider {
  if (FLAGS.visionRealProvider) {
    // Deliberately unimplemented: needs a chosen provider, an API key and a privacy review.
    throw new Error("No real Vision provider is configured.");
  }
  return mockProvider;
}
