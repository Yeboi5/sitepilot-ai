import type { Metadata } from "next";
import { Alert, Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { FINDING_STATUS, formatDate } from "@/lib/format";
import { requireOrg } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Review queue" };

export default async function ReviewQueuePage() {
  await requireOrg("professional");
  const supabase = await createClient();
  // RLS limits findings to documents on active matters where this user holds a grant.
  const { data } = await supabase
    .from("findings")
    .select("id, category, extracted_text, page_ref, confidence, status, created_at, document:documents(file_name)")
    .in("status", ["unreviewed", "needs_clarification"])
    .order("created_at", { ascending: true });
  const rows = data ?? [];

  return (
    <>
      <PageHeader title="Review queue" description="AI-extracted items awaiting professional verification." />
      <div className="mb-6">
        <Alert>
          These are machine-extracted flags, not legal conclusions. Each item cites the source page it came from. Verify it
          against the document before confirming.
        </Alert>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="Queue is empty">New findings appear here once client documents are processed.</EmptyState>
      ) : (
        <div className="space-y-3">
          {rows.map((f) => (
            <Card key={f.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{f.category.replace(/_/g, " ")}</p>
                  <p className="text-xs text-slate-500">
                    {f.document?.file_name ?? "Document"} · page {f.page_ref}
                    {f.confidence !== null ? ` · confidence ${Math.round(f.confidence * 100)}%` : ""} · {formatDate(f.created_at)}
                  </p>
                </div>
                <Badge tone={FINDING_STATUS[f.status].tone}>{FINDING_STATUS[f.status].label}</Badge>
              </div>
              <blockquote className="mt-3 border-l-4 border-slate-200 pl-3 text-sm text-slate-800">{f.extracted_text}</blockquote>
            </Card>
          ))}
          <p className="text-xs text-slate-500">Confirm/reject workflow with source-page viewer arrives with document processing.</p>
        </div>
      )}
    </>
  );
}
