import { setEvidenceStatus } from "../../actions";
import type { EvidenceRow } from "@/components/evidence-register";

const buttonClass = "rounded-md border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-50";

export function EvidenceActions({ row, propertyId }: { row: EvidenceRow; propertyId: string }) {
  if (row.is_demo) {
    return <p className="text-xs text-slate-500">Demo evidence can&apos;t be marked verified.</p>;
  }
  const status = row.verification_status;
  return (
    <form action={setEvidenceStatus} className="flex flex-wrap gap-2">
      <input type="hidden" name="evidenceId" value={row.id} />
      <input type="hidden" name="propertyId" value={propertyId} />
      {status !== "verified" ? (
        <button name="status" value="verified" className={buttonClass}>
          Mark verified against source
        </button>
      ) : (
        <button name="status" value="unverified" className={buttonClass}>
          Mark unverified
        </button>
      )}
      {status !== "disputed" ? (
        <button name="status" value="disputed" className={buttonClass}>
          Flag as disputed
        </button>
      ) : null}
      {status !== "superseded" ? (
        <button name="status" value="superseded" className={buttonClass}>
          Mark superseded
        </button>
      ) : null}
    </form>
  );
}
