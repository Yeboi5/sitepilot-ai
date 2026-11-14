import { getCurrentUser, toActor } from "@/lib/auth/session";
import { appCtx } from "@/lib/services/app-context";
import { exportMyData } from "@/lib/services/privacy";

/** APP 12 access request: everything DealPilot holds about the signed-in user, as JSON. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorised", { status: 401 });
  try {
    const data = await exportMyData(await appCtx(), toActor(user));
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="dealpilot-data-${new Date().toISOString().slice(0, 10)}.json"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "Export failed", { status: 429 });
  }
}
