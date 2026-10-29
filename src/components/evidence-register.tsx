import type { ReactNode } from "react";
import { DemoBadge } from "./demo";
import { Badge, Card, EmptyState } from "./ui";
import { EVIDENCE_STATUS, formatDate } from "@/lib/format";
import type { Enums } from "@/lib/supabase/database.types";
import { EVIDENCE_SOURCE_LABELS } from "@/lib/validation";

export type EvidenceRow = {
  id: string;
  title: string;
  source_type: Enums<"evidence_source_type">;
  source_url: string | null;
  fetched_at: string;
  verification_status: Enums<"evidence_status">;
  verified_at: string | null;
  notes: string | null;
  is_demo: boolean;
  verifier: { display_name: string } | null;
};

export const EVIDENCE_COLUMNS =
  "id, title, source_type, source_url, fetched_at, verification_status, verified_at, notes, is_demo, verifier:users!evidence_verified_by_fkey(display_name)";

/** Evidence register shared by the investor (editable) and conveyancer (read-only) views. */
export function EvidenceRegister({
  rows,
  description,
  actions,
}: {
  rows: EvidenceRow[];
  description: string;
  actions?: (row: EvidenceRow) => ReactNode;
}) {
  return (
    <Card className="p-0">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="font-semibold">Evidence register</h2>
        <p className="text-sm text-slate-600">{description}</p>
      </div>
      {rows.length === 0 ? (
        <div className="p-5">
          <EmptyState title="No evidence recorded">Attach a planning certificate or Planning Portal record to begin.</EmptyState>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((e) => {
            const status = EVIDENCE_STATUS[e.verification_status];
            return (
              <li key={e.id} className="space-y-2 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{e.title}</p>
                    <p className="text-xs text-slate-500">
                      {EVIDENCE_SOURCE_LABELS[e.source_type]} · retrieved {formatDate(e.fetched_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {e.is_demo ? <DemoBadge /> : null}
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                </div>
                {e.source_url ? (
                  e.is_demo ? (
                    // Demo URLs use the reserved .invalid domain; show them as text, not as a link.
                    <p className="break-all font-mono text-xs text-slate-500">{e.source_url}</p>
                  ) : (
                    <a href={e.source_url} target="_blank" rel="noopener noreferrer nofollow" className="block break-all text-sm text-brand-700 underline">
                      {e.source_url}
                    </a>
                  )
                ) : null}
                {e.notes ? <p className="text-sm text-slate-700">{e.notes}</p> : null}
                {e.verification_status === "verified" ? (
                  <p className="text-xs text-slate-500">
                    Verified by {e.verifier?.display_name ?? "a team member"} on {formatDate(e.verified_at)}
                  </p>
                ) : null}
                {actions ? actions(e) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
