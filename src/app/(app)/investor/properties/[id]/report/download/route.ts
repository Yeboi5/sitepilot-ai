import { NextResponse } from "next/server";
import { getOwnedPropertyOr404 } from "@/lib/properties";
import { loadReport, reportFileName } from "@/lib/report/load";
import { renderReportDocument } from "@/lib/report/render";
import { requireOrg } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOrg("investor");
  const supabase = await createClient();
  const property = await getOwnedPropertyOr404(supabase, id, ctx.active.organisation.id);
  const report = await loadReport(supabase, ctx, property);

  const { error } = await supabase.rpc("record_report_export", { prop: property.id, export_format: "html" });
  if (error) return new NextResponse("Export not permitted", { status: 403 });

  return new NextResponse(renderReportDocument(report), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${reportFileName(property.address)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
