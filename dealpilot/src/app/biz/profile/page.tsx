import { Card, Flash, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { CATEGORIES } from "@/lib/domain/categories";
import { flash, type SearchParams } from "@/lib/page";
import { appCtx } from "@/lib/services/app-context";
import { myBusiness } from "@/lib/services/marketplace";
import { updateProfileAction } from "../../actions/business";

export const metadata = { title: "Business profile" };

export default async function Profile({ searchParams }: { searchParams: SearchParams }) {
  const f = await flash(searchParams);
  const { actor } = await requireUser("business");
  const b = await myBusiness(await appCtx(), actor);
  return (
    <>
      <PageHeader title="Business profile" subtitle="Customers see your credentials next to every offer. Licence and insurance details are flagged when missing." />
      <Flash error={f.error} notice={f.notice} />
      <Card>
        <form action={updateProfileAction} className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="name">Business name</label><input className="input" id="name" name="name" defaultValue={b.name} required /></div>
          <div><label className="label" htmlFor="abn">ABN</label><input className="input" id="abn" name="abn" defaultValue={b.abn} inputMode="numeric" placeholder="11 digits" /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="description">About</label><textarea className="input" id="description" name="description" rows={3} defaultValue={b.description} /></div>
          <fieldset className="sm:col-span-2">
            <legend className="label">Service categories</legend>
            <div className="grid gap-1 sm:grid-cols-2">{CATEGORIES.map((c) => <label key={c.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="categories" value={c.id} defaultChecked={b.categories.includes(c.id)} /> {c.name}</label>)}</div>
          </fieldset>
          <div><label className="label" htmlFor="regions">Service regions (one per line)</label><textarea className="input" id="regions" name="regions" rows={3} defaultValue={b.regions.join("\n")} /><p className="mt-1 text-xs text-slate-500">Use &quot;Australia-wide&quot; for national coverage.</p></div>
          <div><label className="label" htmlFor="qualifications">Qualifications (one per line)</label><textarea className="input" id="qualifications" name="qualifications" rows={3} defaultValue={b.qualifications.join("\n")} /></div>
          <div><label className="label" htmlFor="licence">Licence number</label><input className="input" id="licence" name="licence" defaultValue={b.licenceNumber} /></div>
          <label className="flex items-center gap-2 pt-6 text-sm"><input type="checkbox" name="insured" defaultChecked={b.insured} /> We hold current public liability insurance</label>
          <div><button className="btn-primary" type="submit">Save profile</button></div>
        </form>
      </Card>
      <p className="mt-3 text-xs text-slate-500">Production will verify ABNs, licences and insurance certificates against official registers before showing them as verified.</p>
    </>
  );
}
