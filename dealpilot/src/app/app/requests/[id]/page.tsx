import { Check } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card, cx, Empty, Flash, Money, PageHeader, Provenance, StateBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { calculateSavings } from "@/lib/domain/savings";
import { flash, type IdParams, type SearchParams } from "@/lib/page";
import { appCtx } from "@/lib/services/app-context";
import { getRequestForCustomer } from "@/lib/services/marketplace";
import { acceptOfferAction, cancelRequestAction, negotiateOfferAction } from "../../../actions/customer";

export const metadata = { title: "Compare offers" };

export default async function RequestPage({ params, searchParams }: { params: IdParams; searchParams: SearchParams }) {
  const { id } = await params;
  const f = await flash(searchParams);
  const { actor } = await requireUser("customer");
  const data = await getRequestForCustomer(await appCtx(), actor, id).catch(() => null);
  if (!data) notFound();
  const { request: r, category, comparison, negotiations, document } = data;
  const closed = ["awarded", "completed", "cancelled"].includes(r.status);
  return (
    <>
      <PageHeader
        title={r.title}
        subtitle={<>{category.name} · {r.region} · your price <Money cents={r.baselineCents} recurrence={r.recurrence} className="font-semibold" />{document && <> · <Link className="text-brand-700 underline" href={`/app/documents/${document.id}`}>{document.filename}</Link></>}</>}
        actions={!closed && <form action={cancelRequestAction}><input type="hidden" name="id" value={r.id} /><button className="btn-secondary" type="submit">Cancel request</button></form>}
      />
      <Flash error={f.error} notice={f.notice} />
      {Object.keys(r.fields).length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {Object.entries(r.fields).map(([k, v]) => {
            const def = category.fields.find((x) => x.key === k);
            return <Badge key={k}>{def?.label ?? k}: {typeof v === "boolean" ? (v ? "Yes" : "No") : String(v)}{def?.unit ? ` ${def.unit}` : ""}</Badge>;
          })}
        </div>
      )}

      {comparison.length === 0 ? <Empty title="No offers yet">Businesses in {r.region} that serve {category.name.toLowerCase()} have been notified.</Empty> : (
        <Card title={`Compare ${comparison.length} offer${comparison.length === 1 ? "" : "s"}`} action={<span className="text-xs text-slate-500">Ranked using {category.name} weights · raw figures always shown</span>}>
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b text-xs uppercase text-slate-500">
                  <th className="table-cell">Business</th><th className="table-cell">Total price</th><th className="table-cell">You save</th><th className="table-cell">Scope & materials</th>
                  <th className="table-cell">Warranty</th><th className="table-cell">{category.completionLabel}</th><th className="table-cell">Credentials</th><th className="table-cell">Reviews</th><th className="table-cell" />
                </tr>
              </thead>
              <tbody>
                {comparison.map((row, i) => {
                  const s = calculateSavings(r.baselineCents, row.offer.priceCents, r.recurrence);
                  const neg = negotiations.find((n) => n.offerId === row.offer.id);
                  return (
                    <tr key={row.offer.id} className={cx("border-b border-slate-100", i === 0 && "bg-brand-50/50")}>
                      <td className="table-cell">
                        <p className="font-medium">{row.business.name}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {i === 0 && <Badge tone="green">Best overall</Badge>}
                          {row.offer.isSimulated ? <Provenance kind="simulated" /> : <Provenance kind="live">Registered business</Provenance>}
                          {row.offer.aiDrafted && <Badge tone="violet" title="Drafted with AI, approved by a person at the business">AI-assisted</Badge>}
                          {row.offer.status !== "submitted" && <Badge tone="blue">{row.offer.status}</Badge>}
                        </div>
                      </td>
                      <td className="table-cell font-semibold"><Money cents={row.offer.priceCents} recurrence={r.recurrence} />{row.best.price && <Check className="ml-1 inline h-4 w-4 text-brand-600" aria-label="Lowest" />}</td>
                      <td className="table-cell">{s.isSaving ? <span className="text-brand-700"><Money cents={s.periodSavingsCents} /> <span className="text-xs">({s.percent}%)</span></span> : "—"}</td>
                      <td className="table-cell max-w-[220px] text-xs text-slate-600"><p>{row.offer.scope}</p><p className="mt-1 text-slate-500">{row.offer.materials}</p></td>
                      <td className="table-cell">{row.offer.warrantyMonths ? `${row.offer.warrantyMonths} mo` : "—"}{row.best.warranty && <Check className="ml-1 inline h-4 w-4 text-brand-600" aria-label="Longest" />}</td>
                      <td className="table-cell">{row.offer.completionDays} days{row.best.completion && <Check className="ml-1 inline h-4 w-4 text-brand-600" aria-label="Fastest" />}</td>
                      <td className="table-cell text-xs">
                        {row.business.licenceNumber ? <p>Licence {row.business.licenceNumber}</p> : null}
                        {row.business.insured && row.offer.includesInsurance ? <p>Insured</p> : null}
                        {row.flags.filter((x) => x !== "Simulated demo offer").map((x) => <p key={x} className="text-red-700">⚠ {x}</p>)}
                      </td>
                      <td className="table-cell text-xs">{row.verifiedRating !== undefined ? <>★ {row.verifiedRating} <span className="text-slate-500">(verified, {row.business.reviewCount})</span></> : <span className="text-slate-400">No verified reviews</span>}</td>
                      <td className="table-cell">
                        {neg ? <Link className="text-brand-700 underline" href={`/app/negotiations/${neg.id}`}><StateBadge state={neg.state} /></Link> : !closed && ["submitted", "countered"].includes(row.offer.status) && (
                          <div className="flex flex-col gap-2">
                            <form action={negotiateOfferAction}><input type="hidden" name="offerId" value={row.offer.id} /><input type="hidden" name="requestId" value={r.id} /><button className="btn-secondary w-full px-3 py-1.5" type="submit">Negotiate</button></form>
                            <form action={acceptOfferAction} className="space-y-1">
                              <input type="hidden" name="offerId" value={row.offer.id} /><input type="hidden" name="requestId" value={r.id} />
                              <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="confirm" required /> I accept this offer</label>
                              <button className="btn-primary w-full px-3 py-1.5" type="submit">Accept</button>
                            </form>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {category.notes && <p className="mt-3 text-xs text-slate-500">{category.notes}</p>}
        </Card>
      )}
      <p className="mt-6 text-sm"><Link href="/app/requests" className="text-brand-700">← All requests</Link></p>
    </>
  );
}
