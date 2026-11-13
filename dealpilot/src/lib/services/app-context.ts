import "server-only";
import { getAI } from "../ai";
import { feeConfig } from "../config";
import { getStore } from "../store";
import type { Ctx } from "./context";

export async function appCtx(): Promise<Ctx> {
  return { store: await getStore(), ai: getAI(), fees: feeConfig(), now: () => new Date() };
}
