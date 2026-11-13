import { MockAIProvider } from "@/lib/ai/mock";
import type { Actor } from "@/lib/domain/types";
import type { Ctx } from "@/lib/services/context";
import { MemoryStore } from "@/lib/store/memory";
import { IDS, seedDemoData } from "@/lib/store/seed";

export const NOW = new Date("2026-11-13T00:00:00Z");

export async function makeCtx(now = NOW): Promise<Ctx> {
  const store = new MemoryStore();
  await seedDemoData(store, now);
  return { store, ai: new MockAIProvider(), fees: { successFeeCents: 150, currency: "AUD" }, now: () => now };
}

export const alex: Actor = { userId: IDS.alex, role: "customer" };
export const priya: Actor = { userId: IDS.priya, role: "customer" };
export const jordan: Actor = { userId: IDS.jordan, role: "customer" };
export const ben: Actor = { userId: IDS.ben, role: "business", businessId: IDS.bBen };
export const erin: Actor = { userId: IDS.erin, role: "business", businessId: IDS.bErin };
export const admin: Actor = { userId: IDS.admin, role: "admin" };
