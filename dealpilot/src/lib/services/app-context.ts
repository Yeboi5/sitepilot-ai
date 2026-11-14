import "server-only";
import { getAI } from "../ai";
import { appUrl, dataDriver, demoMode, feeConfig } from "../config";
import { smtpEmailProvider, type EmailProvider } from "../integrations/notifications";
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

let email: EmailProvider | null | undefined;
function getEmail(): Ctx["email"] {
  if (email === undefined) email = process.env.SMTP_URL ? smtpEmailProvider(process.env.SMTP_URL, process.env.EMAIL_FROM ?? "DealPilot <no-reply@dealpilot.invalid>") : null;
  return email ? { provider: email, appUrl: appUrl() } : undefined;
}

export async function appCtx(): Promise<Ctx> {
  return { store: await getStore(), ai: getAI(), fees: feeConfig(), now: () => new Date(), scanner: getScanner(), email: getEmail() };
}
