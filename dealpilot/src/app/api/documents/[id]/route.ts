import { getCurrentUser, toActor } from "@/lib/auth/session";
import { appCtx } from "@/lib/services/app-context";
import { getDocumentFile } from "@/lib/services/documents";

/** Owner-only document download. Never cached; served as an attachment so it can't execute in our origin. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorised", { status: 401 });
  const { id } = await params;
  try {
    const { doc, blob } = await getDocumentFile(await appCtx(), toActor(user), id);
    return new Response(Buffer.from(blob.data), {
      headers: {
        "Content-Type": doc.mimeType,
        "Content-Disposition": `attachment; filename="${doc.filename.replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
