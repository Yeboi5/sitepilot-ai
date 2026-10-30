import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { prepareSource, watermark } = await import("./image");
const { mockProvider } = await import("./provider");
const { PRESETS, isPreset, presetLabel } = await import("./presets");

async function photo(width = 640, height = 480, withExif = true) {
  let img = sharp({ create: { width, height, channels: 3, background: "#88aa66" } }).jpeg();
  if (withExif) img = img.withExif({ IFD0: { Make: "TestCam", Model: "Serial-123" }, IFD3: { GPSLatitude: "33/1 52/1 0/1", GPSLatitudeRef: "S" } });
  return img.toBuffer();
}

describe("Vision presets", () => {
  it("covers the blueprint's three modes", () => {
    expect(PRESETS.birds_eye.map((p) => p.id)).toEqual(["pool", "granny_flat", "garden", "extension", "driveway", "subdivision_concept"]);
    expect(PRESETS.exterior.map((p) => p.id)).toEqual(["facade", "fence", "roof"]);
    expect(PRESETS.interior.map((p) => p.id)).toEqual(["kitchen", "bathroom", "layout"]);
  });
  it("validates presets per mode", () => {
    expect(isPreset("birds_eye", "pool")).toBe(true);
    expect(isPreset("interior", "pool")).toBe(false);
    expect(presetLabel("exterior", "facade")).toBe("New facade");
  });
});

describe("prepareSource", () => {
  it("strips EXIF (including GPS) and re-encodes as JPEG", async () => {
    const input = await photo();
    expect((await sharp(input).metadata()).exif).toBeDefined();
    const res = await prepareSource(input);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const meta = await sharp(res.image.bytes).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.exif).toBeUndefined();
    expect(res.image.bytes.includes(Buffer.from("Serial-123"))).toBe(false);
    expect([res.image.width, res.image.height]).toEqual([640, 480]);
  });
  it("caps large photos at 2048 px", async () => {
    const res = await prepareSource(await sharp({ create: { width: 4000, height: 1000, channels: 3, background: "#000" } }).png().toBuffer());
    expect(res.ok && [res.image.width, res.image.height]).toEqual([2048, 512]);
  });
  it("rejects non-images, tiny images and oversized files", async () => {
    expect(await prepareSource(Buffer.from("%PDF-1.4 hello"))).toEqual({ ok: false, error: "Upload a JPG, PNG or WebP photo." });
    expect((await prepareSource(await photo(100, 100, false))).ok).toBe(false);
    expect(await prepareSource(new Uint8Array(15 * 1024 * 1024 + 1))).toEqual({ ok: false, error: "Photos must be 15 MB or smaller." });
    expect((await prepareSource(Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01]))).ok).toBe(false); // truncated JPEG
  });
});

describe("mock provider and watermark", () => {
  it("is deterministic and changes the image", async () => {
    const src = (await prepareSource(await photo())) as { ok: true; image: { bytes: Buffer } };
    const req = { image: src.image.bytes, mode: "birds_eye" as const, preset: "pool", style: "coastal" as const, prompt: null };
    const a = await mockProvider.generate(req);
    const b = await mockProvider.generate(req);
    expect(a.image.equals(b.image)).toBe(true);
    expect(a).toMatchObject({ provider: "mock", model: "mock-1", costCents: 0 });
    const [s, o] = await Promise.all([sharp(src.image.bytes).stats(), sharp(a.image).stats()]);
    expect(o.channels[2]!.mean).not.toBeCloseTo(s.channels[2]!.mean, 0);
  });
  it("watermark keeps the size and darkens the bottom band", async () => {
    const src = await sharp({ create: { width: 800, height: 600, channels: 3, background: "#ffffff" } }).jpeg().toBuffer();
    const out = await watermark(src);
    const meta = await sharp(out).metadata();
    expect([meta.width, meta.height]).toEqual([800, 600]);
    const band = await sharp(await sharp(out).extract({ left: 0, top: 570, width: 800, height: 30 }).toBuffer()).stats(); // stats() reads its input
    expect(band.channels[0]!.mean).toBeLessThan(150);
  });
});
