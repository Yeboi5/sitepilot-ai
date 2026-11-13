import "server-only";
import { dataDriver } from "../config";
import { MemoryStore } from "./memory";
import { seedDemoData } from "./seed";
import { SupabaseStore } from "./supabase";
import type { Store } from "./types";

const g = globalThis as unknown as { __dealpilotStore?: Promise<Store> };

async function createMemory(): Promise<Store> {
  const s = new MemoryStore();
  await seedDemoData(s);
  return s;
}

export function getStore(): Promise<Store> {
  if (!g.__dealpilotStore) {
    g.__dealpilotStore = dataDriver() === "supabase" ? Promise.resolve(new SupabaseStore()) : createMemory();
  }
  return g.__dealpilotStore;
}

/** Resets the in-memory demo store to the seeded state. Not available for Supabase. */
export async function resetDemoStore(): Promise<void> {
  if (dataDriver() !== "memory") throw new Error("Demo reset is only available with the memory driver");
  g.__dealpilotStore = createMemory();
  await g.__dealpilotStore;
}
