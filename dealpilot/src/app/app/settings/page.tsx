import { Card, Flash, PageHeader, Provenance, relTime } from "@/components/ui";
import { requireUser } from "@/lib/auth/session";
import { MODE_LABELS } from "@/lib/domain/negotiation";
import { flash, type SearchParams } from "@/lib/page";
import { listMyAudit } from "@/lib/services/accounts";
import { appCtx } from "@/lib/services/app-context";
import { PrivacyCard } from "@/components/privacy-card";
import { aiProviderName } from "@/lib/config";
import { updateSettingsAction } from "../../actions/customer";

export const metadata = { title: "AI permissions" };

export default async function Settings({ searchParams }: { searchParams: SearchParams }) {
  const f = await flash(searchParams);
  const { user, actor } = await requireUser("customer");
  const log = await listMyAudit(await appCtx(), actor, 30);
  return (
    <>
      <PageHeader title="AI permissions" subtitle="You decide how much DealPilot's AI may do for you. Change it any time, per negotiation too." />
      <Flash error={f.error} notice={f.notice} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <form action={updateSettingsAction} className="space-y-4">
            <fieldset className="space-y-2">
              <legend className="label">Default mode</legend>
              {Object.entries(MODE_LABELS).map(([k, v]) => (
                <label key={k} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
                  <input type="radio" name="mode" value={k} defaultChecked={user.permissionMode === k} className="mt-1" />
                  <span><span className="flex items-center gap-2 font-medium">{v.label} {k === "autopilot" && <Provenance kind="future" />}</span><span className="text-sm text-slate-600">{v.description}</span></span>
                </label>
              ))}
            </fieldset>
            <div><label className="label" htmlFor="limit">Limited Autopilot spending limit per action (AUD)</label><input className="input" id="limit" name="limit" inputMode="decimal" defaultValue={(user.autopilotLimitCents / 100).toFixed(2)} /><p className="mt-1 text-xs text-slate-500">0 disables autonomous actions. Autopilot never accepts above your target price and only acts with simulated counterparties in this prototype.</p></div>
            <div><label className="label" htmlFor="region">Your region</label><input className="input" id="region" name="region" defaultValue={user.region} /></div>
            <button className="btn-primary" type="submit">Save</button>
          </form>
        </Card>
        <PrivacyCard user={user} aiProvider={aiProviderName()} />
        <Card title="Your activity log">
          <ul className="max-h-[480px] space-y-1 overflow-auto text-sm">
            {log.map((a) => <li key={a.id} className="flex justify-between gap-2 border-b border-slate-100 py-1"><span className="font-mono text-xs">{a.action}</span><span className="text-xs text-slate-500">{relTime(a.at)}</span></li>)}
          </ul>
        </Card>
      </div>
    </>
  );
}
