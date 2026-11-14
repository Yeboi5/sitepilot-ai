import { CheckCircle2, Clock } from "lucide-react";
import { pendingApprovals } from "@/lib/domain/negotiation";
import type { Negotiation } from "@/lib/domain/types";
import { Badge, Card, Money } from "./ui";

const EXEMPT: Record<string, string> = {
  simulated: "Simulated counterparty — approval simulated (demonstration only)",
  not_applicable: "No business party on DealPilot (e.g. a retailer price adjustment)",
  pre_approved: "Pre-approved by the business when it published the group offer",
};

/** Final terms both parties must approve. `action` is the approve server action for this side. */
export function FinalTermsCard({ n, side, action }: { n: Negotiation; side: "customer" | "business"; action: (fd: FormData) => Promise<void> }) {
  const t = n.finalTerms;
  if (!t) return null;
  const waiting = pendingApprovals(t);
  const mine = waiting.includes(side);
  const row = (label: string, at?: string, exempt?: string) => (
    <li className="flex items-start gap-2 text-sm">
      {at || exempt ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden /> : <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />}
      <span>{label}: {at ? `approved ${new Date(at).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })}` : exempt ?? "waiting"}</span>
    </li>
  );
  return (
    <Card title="Final terms" className={mine ? "border-amber-300" : undefined} action={waiting.length ? <Badge tone="amber">Awaiting approval</Badge> : <Badge tone="green">Approved by both</Badge>}>
      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div><dt className="text-xs text-slate-500">Price</dt><dd className="font-semibold"><Money cents={t.priceCents} recurrence={t.recurrence} /></dd></div>
        {t.warrantyMonths !== undefined && <div><dt className="text-xs text-slate-500">Warranty</dt><dd>{t.warrantyMonths} months</dd></div>}
        {t.completionDays !== undefined && <div><dt className="text-xs text-slate-500">Completion</dt><dd>{t.completionDays} days</dd></div>}
        <div><dt className="text-xs text-slate-500">Proposed by</dt><dd className="capitalize">{t.proposedBy}</dd></div>
      </dl>
      {t.scope && <p className="mt-2 text-sm text-slate-600">{t.scope}</p>}
      <ul className="mt-3 space-y-1">
        {row("Customer", t.customerApprovedAt)}
        {row(n.counterpartyName, t.businessApprovedAt, t.businessApproval === "required" ? undefined : EXEMPT[t.businessApproval])}
      </ul>
      {mine && n.state === "final_approval" && (
        <form action={action} className="mt-4 space-y-2 border-t border-slate-100 pt-3">
          <input type="hidden" name="id" value={n.id} />
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="confirm" required className="mt-1" />
            <span>{side === "customer" ? "I approve these final terms." : `I approve these final terms on behalf of ${n.counterpartyName}.`} This is a commitment between the customer and the business; DealPilot is not a party to it and never moves money.</span>
          </label>
          <button className="btn-primary" type="submit">Approve final terms</button>
        </form>
      )}
    </Card>
  );
}
