import "server-only";
import { getAI } from "../ai";
import { dataDriver, demoMode, feeConfig } from "../config";
import { builtinScanner, clamdScanner, type Scanner } from "../integrations/scanner";
import { getStore } from "../store";
import type { Ctx } from "./context";

/** Production (real data, not a demo) must scan uploads with real antivirus; otherwise uploads are refused. */
export function antivirusRequired(): boolean {
  if (process.env.UPLOAD_ANTIVIRUS_REQUIRED) return process.env.UPLOAD_ANTIVIRUS_REQUIRED === "true";
  return process.env.NODE_ENV === "production" && dataDriver() === "supabase" && !demoMode();
}

let scanner: Scanner | undefined;
function getScanner(): Scanner {
  if (scanner) return scanner;
  const host = process.env.CLAMD_HOST;
  if (host) scanner = clamdScanner(host, Number(process.env.CLAMD_PORT ?? 3310));
  else if (antivirusRequired()) {
    scanner = { name: "unconfigured", antivirus: false, scan: async () => { throw new Error("Antivirus is required but CLAMD_HOST is not configured"); } };
  } else scanner = builtinScanner;
  return scanner;
}

export async function appCtx(): Promise<Ctx> {
  return { store: await getStore(), ai: getAI(), fees: feeConfig(), now: () => new Date(), scanner: getScanner() };
}
