import { aiProviderName, dataDriver, demoMode } from "@/lib/config";
import { paymentProvider } from "@/lib/integrations/payments";
import { antivirusRequired } from "@/lib/services/app-context";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Liveness + dependency check for uptime monitoring. Reveals configuration state, never secrets. */
export async function GET() {
  const started = Date.now();
  let db: "ok" | "error" = "ok";
  try {
    await (await getStore()).get("users", "00000000-0000-0000-0000-000000000000");
  } catch {
    db = "error";
  }
  const body = {
    status: db === "ok" ? "ok" : "degraded",
    driver: dataDriver(),
    demo: demoMode(),
    checks: {
      database: db,
      ai: aiProviderName(),
      email: process.env.SMTP_URL ? "configured" : "in-app only",
      antivirus: process.env.CLAMD_HOST ? "clamav" : antivirusRequired() ? "REQUIRED BUT MISSING — uploads refused" : "baseline only",
      payments: paymentProvider().live ? "live" : "disabled",
    },
    latencyMs: Date.now() - started,
  };
  return Response.json(body, { status: db === "ok" ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
