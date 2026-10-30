/**
 * SitePilot Vision modes, presets and styles (Master Blueprint v2.0 §5). Shared by the UI, the
 * server actions (validation) and the image provider. Concepts are illustrative only.
 */
export type VisionMode = "birds_eye" | "exterior" | "interior";

export const MODES: Record<VisionMode, { label: string; hint: string }> = {
  birds_eye: { label: "Bird's-eye", hint: "A photo looking down on the block, e.g. from a drone you're allowed to fly" },
  exterior: { label: "Street or exterior", hint: "The front or outside of the home" },
  interior: { label: "Interior", hint: "A room inside" },
};

export const PRESETS: Record<VisionMode, { id: string; label: string }[]> = {
  birds_eye: [
    { id: "pool", label: "Pool" },
    { id: "granny_flat", label: "Granny flat" },
    { id: "garden", label: "Garden" },
    { id: "extension", label: "Extension" },
    { id: "driveway", label: "Driveway" },
    { id: "subdivision_concept", label: "Subdivision concept" },
  ],
  exterior: [
    { id: "facade", label: "New facade" },
    { id: "fence", label: "Fence" },
    { id: "roof", label: "Roof" },
  ],
  interior: [
    { id: "kitchen", label: "Kitchen" },
    { id: "bathroom", label: "Bathroom" },
    { id: "layout", label: "Open-plan layout" },
  ],
};

export const STYLES = [
  { id: "modern", label: "Modern" },
  { id: "coastal", label: "Coastal" },
  { id: "classic", label: "Classic" },
  { id: "natural", label: "Natural" },
] as const;
export type VisionStyle = (typeof STYLES)[number]["id"];

export const VISION_DISCLAIMER =
  "AI CONCEPT: an illustration only. It isn't to scale, doesn't show boundaries, and isn't a plan, approval or advice. Check council rules and use licensed professionals before building.";

export function isPreset(mode: VisionMode, preset: string): boolean {
  return PRESETS[mode].some((p) => p.id === preset);
}

export function presetLabel(mode: VisionMode, preset: string): string {
  return PRESETS[mode].find((p) => p.id === preset)?.label ?? preset;
}

export function styleLabel(style: string): string {
  return STYLES.find((s) => s.id === style)?.label ?? style;
}
