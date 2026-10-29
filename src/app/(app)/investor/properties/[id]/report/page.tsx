import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink, Card } from "@/components/ui";
import { getOwnedPropertyOr404 } from "@/lib/properties";
import { loadReport } from "@/lib/report/load";
import { REPORT_CSS, renderReportBody } from "@/lib/report/render";
import { requireOrg } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Report" };

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireOrg("investor");
  const supabase = await createClient();
  const property = await getOwnedPropertyOr404(supabase, id, ctx.active.organisation.id);
  const report = await loadReport(supabase, ctx, property);
  await supabase.rpc("record_report_export", { prop: property.id, export_format: "view" });

  return (
    <>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/investor/properties/${property.id}`} className="text-sm text-brand-700 underline">
          ← {property.address}
        </Link>
        <div className="flex gap-2">
          <PrintButton />
          <ButtonLink href={`/investor/properties/${property.id}/report/download`} prefetch={false}>
            Download report (.html)
          </ButtonLink>
        </div>
      </div>
      <style>{REPORT_CSS}</style>
      <Card className="p-8">
        {/* Every value in the body is HTML-escaped by renderReportBody (see report.test.ts). */}
        <article className="sp-report" dangerouslySetInnerHTML={{ __html: renderReportBody(report) }} />
      </Card>
    </>
  );
}
