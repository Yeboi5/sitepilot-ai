import type { StoredDocument, Transaction } from "@/lib/domain/types";
import { cancelTransactionAction, verifyTransactionAction } from "@/app/actions/customer";
import { Money } from "./ui";

export function VerifyForm({ tx, docs, back, feeCents }: { tx: Transaction; docs: StoredDocument[]; back: string; feeCents: number }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-700">
        Agreed at <Money cents={tx.finalCents} recurrence={tx.recurrence} className="font-semibold" /> vs <Money cents={tx.baselineCents} recurrence={tx.recurrence} /> before.
        Once the job is done or the new price appears on your bill, confirm the <strong>final invoiced amount</strong>. Savings are recalculated from it.
      </p>
      <form action={verifyTransactionAction} className="grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="txId" value={tx.id} />
        <input type="hidden" name="back" value={back} />
        <div><label className="label" htmlFor={`final-${tx.id}`}>Final amount on invoice/bill</label><input className="input" id={`final-${tx.id}`} name="finalAmount" inputMode="decimal" defaultValue={(tx.finalCents / 100).toFixed(2)} required /></div>
        <div>
          <label className="label" htmlFor={`ev-${tx.id}`}>Evidence (optional)</label>
          <select className="input" id={`ev-${tx.id}`} name="evidenceDocumentId" defaultValue="">
            <option value="">No document — I confirm it myself</option>
            {docs.map((d) => <option key={d.id} value={d.id}>{d.filename}</option>)}
          </select>
        </div>
        <label className="flex items-start gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="confirm" required className="mt-1" />
          <span>I confirm this deal was completed at the amount above. If there is a saving, a <Money cents={feeCents} /> success fee is recorded (simulated in this prototype — no real charge). No saving, no fee.</span>
        </label>
        <div className="flex flex-wrap gap-2 sm:col-span-2"><button className="btn-primary" type="submit">Verify saving</button></div>
      </form>
      <form action={cancelTransactionAction} className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <input type="hidden" name="txId" value={tx.id} />
        <input type="hidden" name="back" value={back} />
        <input className="input max-w-xs" name="reason" placeholder="Reason (optional)" />
        <button className="btn-danger" type="submit">It didn&apos;t go ahead</button>
      </form>
    </div>
  );
}
