import { Badge, Card, Flash, PageHeader } from "@/components/ui";
import { AbnBadge, CredentialBadge, VerificationBadge } from "@/components/verification-badges";
import { requireUser } from "@/lib/auth/session";
import { credentialState } from "@/lib/domain/verification";
import { flash, type SearchParams } from "@/lib/page";
import { appCtx } from "@/lib/services/app-context";
import { myVerification } from "@/lib/services/verification";
import { addCredentialAction, requestVerificationAction, submitAbnAction } from "../../actions/business";

export const metadata = { title: "Verification" };

export default async function Verification({ searchParams }: { searchParams: SearchParams }) {
  const f = await flash(searchParams);
  const { actor } = await requireUser("business");
  const ctx = await appCtx();
  const v = await myVerification(ctx, actor);
  const b = v.business;
  return (
    <>
      <PageHeader title="Verification" subtitle="Customers only see genuine offers from businesses DealPilot has verified. Uploading documents doesn't verify you — an administrator checks them." actions={<VerificationBadge status={b.verificationStatus} />} />
      <Flash error={f.error} notice={f.notice} />
      {b.statusReason && <p className="mb-4 rounded-lg bg-slate-100 p-3 text-sm">Note from DealPilot: {b.statusReason}</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="1. Australian Business Number" action={<AbnBadge status={b.abnStatus} />}>
          {b.abnEntityName && <p className="mb-2 text-sm">Registered entity: <strong>{b.abnEntityName}</strong></p>}
          <form action={submitAbnAction} className="flex gap-2">
            <input className="input" name="abn" inputMode="numeric" defaultValue={b.abn} placeholder="11 digits" aria-label="ABN" required />
            <button className="btn-secondary" type="submit">Check</button>
          </form>
          <p className="mt-2 text-xs text-slate-500">We validate the number and check it on the Australian Business Register when that service is connected; otherwise an administrator confirms it manually.</p>
        </Card>
        <Card title="2. Licences & insurance">
          <ul className="space-y-2">
            {(["licence", "insurance"] as const).map((k) => (
              <li key={k} className="flex items-center justify-between gap-2 text-sm"><span className="capitalize">{k}</span><CredentialBadge state={credentialState(v.credentials, k, ctx.now()).state} /></li>
            ))}
          </ul>
          {v.credentials.length > 0 && (
            <ul className="mt-3 divide-y divide-slate-100 text-xs">
              {v.credentials.map((c) => (
                <li key={c.id} className="py-2">
                  <span className="font-medium capitalize">{c.kind}</span> {c.reference} · {c.issuer} {c.expiresAt && `· expires ${new Date(c.expiresAt).toLocaleDateString("en-AU")}`}{" "}
                  <Badge tone={c.status === "verified" ? "green" : c.status === "rejected" ? "red" : "amber"}>{c.status}</Badge>
                  {c.evidenceDocumentId ? <span className="ml-1 text-slate-500">evidence attached</span> : <span className="ml-1 text-red-700">no evidence</span>}
                </li>
              ))}
            </ul>
          )}
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium text-brand-700">Add a licence or insurance certificate</summary>
            <form action={addCredentialAction} className="mt-3 grid gap-2 sm:grid-cols-2">
              <select className="input" name="kind" aria-label="Type"><option value="licence">Licence</option><option value="insurance">Public liability insurance</option></select>
              <input className="input" name="reference" placeholder="Licence / policy number" required />
              <input className="input" name="issuer" placeholder="Issued by (e.g. NSW Fair Trading)" />
              <input className="input" name="jurisdiction" placeholder="State / territory" />
              <label className="text-xs text-slate-600 sm:col-span-2">Expiry date<input className="input mt-1" type="date" name="expiresAt" /></label>
              <label className="text-xs text-slate-600 sm:col-span-2">Evidence (PDF or image, required for review)<input className="input mt-1" type="file" name="evidence" accept=".pdf,.png,.jpg,.jpeg,.webp" /></label>
              <button className="btn-secondary sm:col-span-2" type="submit">Submit for review</button>
            </form>
          </details>
        </Card>
      </div>
      <Card title="3. Request verification" className="mt-4">
        {v.blockers.length > 0 && <ul className="mb-3 list-disc space-y-1 pl-5 text-sm text-slate-700">{v.blockers.map((x) => <li key={x}>{x}</li>)}</ul>}
        {b.verificationStatus === "verified" ? <p className="text-sm text-brand-800">Your business is verified. Keep your licence and insurance current — expired credentials stop new offers.</p>
          : b.verificationStatus === "pending" ? <p className="text-sm">An administrator is reviewing your business.</p>
          : <form action={requestVerificationAction}><button className="btn-primary" type="submit" disabled={b.verificationStatus === "suspended"}>Request verification</button></form>}
      </Card>
    </>
  );
}
