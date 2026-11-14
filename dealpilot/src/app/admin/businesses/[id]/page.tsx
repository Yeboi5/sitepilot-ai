import { notFound } from "next/navigation";
import { Badge, Card, Flash, PageHeader } from "@/components/ui";
import { AbnBadge, VerificationBadge } from "@/components/verification-badges";
import { requireUser } from "@/lib/auth/session";
import { flash, type IdParams, type SearchParams } from "@/lib/page";
import { appCtx } from "@/lib/services/app-context";
import { getBusinessForAdmin } from "@/lib/services/verification";
import { confirmAbnAction, reviewCredentialAction, setBusinessStatusAction } from "../../../actions/admin";

export const metadata = { title: "Review business" };

export default async function ReviewBusiness({ params, searchParams }: { params: IdParams; searchParams: SearchParams }) {
  const { id } = await params;
  const f = await flash(searchParams);
  const { actor } = await requireUser("admin");
  const data = await getBusinessForAdmin(await appCtx(), actor, id).catch(() => null);
  if (!data) notFound();
  const { business: b, credentials, owner, blockers, history } = data;
  return (
    <>
      <PageHeader title={b.name} subtitle={<>Owner: {owner?.name} ({owner?.email}) · categories: {b.categories.join(", ")} · regions: {b.regions.join(", ")}</>} actions={<VerificationBadge status={b.verificationStatus} />} />
      <Flash error={f.error} notice={f.notice} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="ABN" action={<AbnBadge status={b.abnStatus} />}>
          <p className="text-sm">ABN: <strong>{b.abn ?? "not provided"}</strong>{b.abnEntityName && <> · {b.abnEntityName}</>}</p>
          {b.abn && b.abnStatus === "checksum_valid" && (
            <form action={confirmAbnAction} className="mt-3 space-y-2">
              <input type="hidden" name="businessId" value={b.id} />
              <p className="text-xs text-slate-600">ABN Lookup web service isn&apos;t connected. Search <a className="underline" href={`https://abr.business.gov.au/ABN/View?abn=${b.abn}`} target="_blank" rel="noreferrer">abr.business.gov.au</a> and record what it shows.</p>
              <input className="input" name="entityName" placeholder="Entity name shown on ABN Lookup" required />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="checked" required /> I checked the ABN is active and matches this business</label>
              <button className="btn-secondary" type="submit">Confirm ABN</button>
            </form>
          )}
        </Card>
        <Card title="Decision">
          {blockers.length > 0 && <ul className="mb-3 list-disc pl-5 text-sm text-amber-900">{blockers.map((x) => <li key={x}>{x}</li>)}</ul>}
          <form action={setBusinessStatusAction} className="space-y-2">
            <input type="hidden" name="businessId" value={b.id} />
            <select className="input" name="status" defaultValue={b.verificationStatus === "verified" ? "suspended" : "verified"} aria-label="Status">
              <option value="verified">Verify</option><option value="rejected">Reject</option><option value="suspended">Suspend</option><option value="unverified">Reset to unverified</option>
            </select>
            <input className="input" name="reason" placeholder="Reason (shown to the business; required to reject or suspend)" />
            <button className="btn-primary" type="submit">Record decision</button>
          </form>
        </Card>
      </div>
      <Card title="Credentials" className="mt-4">
        {credentials.length === 0 ? <p className="text-sm text-slate-600">None submitted.</p> : (
          <ul className="space-y-3">
            {credentials.map((c) => (
              <li key={c.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                <p className="flex flex-wrap items-center gap-2"><strong className="capitalize">{c.kind}</strong> {c.reference} · {c.issuer} · {c.jurisdiction} {c.expiresAt && `· expires ${new Date(c.expiresAt).toLocaleDateString("en-AU")}`}
                  <Badge tone={c.status === "verified" ? "green" : c.status === "rejected" ? "red" : "amber"}>{c.status}</Badge></p>
                {c.evidenceDocumentId ? <a className="text-brand-700 underline" href={`/api/documents/${c.evidenceDocumentId}`}>Open evidence</a> : <span className="text-red-700">No evidence uploaded</span>}
                {c.notes && <p className="mt-1 text-xs text-slate-500">Notes: {c.notes}</p>}
                <form action={reviewCredentialAction} className="mt-2 grid gap-2 sm:grid-cols-4">
                  <input type="hidden" name="businessId" value={b.id} /><input type="hidden" name="credentialId" value={c.id} />
                  <select className="input" name="decision" aria-label="Decision"><option value="verified">Verified</option><option value="rejected">Rejected</option></select>
                  <select className="input" name="method" aria-label="Method"><option value="admin_document_review">Checked evidence</option><option value="register_lookup">Checked public register</option></select>
                  <input className="input" name="notes" placeholder="What did you check?" required />
                  <button className="btn-secondary" type="submit">Record</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="History" className="mt-4">
        <ul className="text-xs">{history.map((h) => <li key={h.id} className="border-b border-slate-100 py-1 font-mono">{new Date(h.at).toLocaleString("en-AU")} · {h.action} · {h.actorRole}</li>)}</ul>
      </Card>
    </>
  );
}
