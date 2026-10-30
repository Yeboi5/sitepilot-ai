# SitePilot Vision: choosing an image provider

Status: **mock provider in use** (Blueprint v2.0 decision 6). Claude reads images but can't
generate or edit them (limitation L3), so real concepts need a third-party image-editing model.
This checklist is for the comparison before one is chosen. Prices, terms and regions change;
verify each item against the provider's current documentation and contract.

## Candidates

OpenAI image editing, Google (Gemini / Imagen), Stability AI, Black Forest Labs (direct or via a
host). Add others as needed.

## Criteria

| Area | Questions |
| --- | --- |
| Capability | Edits a supplied photo (inpainting or instruction editing), not only text-to-image? Keeps the rest of the photo intact? Output size? |
| Quality | Run the same 12 test photos (4 per mode, our own or licensed) through every preset; score realism and how well the original is preserved |
| Cost | Price per edit at our output size; minimums; how to cap spend per account (we also cap 10 per user per day) |
| Latency | Typical and worst-case seconds per edit; sync vs async API |
| Data terms | Are inputs or outputs used for training? Retention period? Zero-retention option? |
| Privacy | Where is data processed? Australian Privacy Principle 8 (overseas disclosure) and our privacy policy wording |
| Safety | Built-in filters for people and faces; can we block edits that add or remove people? |
| Rights | Who owns outputs? Any restrictions on commercial use or sharing? |
| Reliability | SLA, rate limits, status history |
| Integration | Official SDK or plain HTTPS; how keys are scoped; support for an AU or nearby region |

## What doesn't change

Whichever provider is chosen, SitePilot keeps doing these itself: re-encoding uploads (EXIF strip),
reserving a credit before each call, stamping the AI CONCEPT mark after the call, private storage,
and secret share links. The provider receives only the re-encoded photo, preset, style and the
user's optional description.

## To go live

1. Choose a provider using the table above, and record the decision in an ADR.
2. Supply an API key as a server-only environment variable (never `NEXT_PUBLIC_*`).
3. Implement `VisionProvider` in `src/lib/vision/provider.ts` and add contract tests.
4. Update the privacy policy, then switch on `NEXT_PUBLIC_FLAG_VISION_REAL_PROVIDER`.
