import { Badge, Card, Empty, Flash, Money, PageHeader, Provenance } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { getCategory } from "@/lib/domain/categories";
import { flash, type SearchParams } from "@/lib/page";
import { appCtx } from "@/lib/services/app-context";
import { listGroupsForBusiness } from "@/lib/services/groups";
import { submitGroupOfferAction } from "../../actions/business";

export const metadata = { title: "Bulk offers" };

export default async function BizGroups({ searchParams }: { searchParams: SearchParams }) {
  const f = await flash(searchParams);
  const { actor } = await requireUser("business");
  const list = await listGroupsForBusiness(await appCtx(), actor);
  return (
    <>
      <PageHeader title="Bulk purchasing offers" subtitle="Publish volume pricing tiers to buying groups in your categories and regions." />
      <Flash error={f.error} notice={f.notice} />
      {list.length === 0 ? <Empty title="No matching groups" /> : (
        <div className="space-y-4">
          {list.map(({ group: g, status: s, myOffer }) => (
            <Card key={g.id} title={g.title} action={<span className="flex gap-1">{g.isSimulated && <Provenance kind="simulated" />}<Badge tone="blue">{s.members} members</Badge></span>}>
              <p className="text-sm text-slate-600">{getCategory(g.categoryId).name} · {g.region} · members currently pay about <Money cents={g.baselineCents} recurrence={g.recurrence} /> · closes in {s.daysLeft} days</p>
              {myOffer && <p className="mt-2 text-sm">Your offer: {myOffer.tiers.map((t) => <Badge key={t.minMembers} tone="green">{t.minMembers}+ → <Money cents={t.priceCents} /></Badge>)}</p>}
              <details className="mt-3" open={!myOffer && g.offers.length === 0}>
                <summary className="cursor-pointer text-sm font-medium text-brand-700">{myOffer ? "Replace your offer" : "Submit a volume offer"}</summary>
                <form action={submitGroupOfferAction} className="mt-3 grid gap-3 sm:grid-cols-3">
                  <input type="hidden" name="groupId" value={g.id} />
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="rounded-xl border border-slate-200 p-3">
                      <p className="text-xs font-medium text-slate-500">Tier {i}{i > 1 && " (optional)"}</p>
                      <label className="label mt-1" htmlFor={`min${i}-${g.id}`}>Min members</label><input className="input" id={`min${i}-${g.id}`} name={`min${i}`} inputMode="numeric" required={i === 1} />
                      <label className="label mt-2" htmlFor={`price${i}-${g.id}`}>Price each</label><input className="input" id={`price${i}-${g.id}`} name={`price${i}`} inputMode="decimal" required={i === 1} />
                    </div>
                  ))}
                  <div className="sm:col-span-2"><label className="label" htmlFor={`terms-${g.id}`}>Terms</label><input className="input" id={`terms-${g.id}`} name="terms" placeholder="What's included, warranty, conditions" /></div>
                  <div><label className="label" htmlFor={`valid-${g.id}`}>Valid (days)</label><input className="input" id={`valid-${g.id}`} name="validDays" defaultValue="14" inputMode="numeric" /></div>
                  <label className="flex items-start gap-2 text-sm sm:col-span-3"><input type="checkbox" name="approve" required className="mt-1" /> I approve this volume offer on behalf of my business. Larger tiers must be cheaper.</label>
                  <div><button className="btn-primary" type="submit">Publish offer</button></div>
                </form>
              </details>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
