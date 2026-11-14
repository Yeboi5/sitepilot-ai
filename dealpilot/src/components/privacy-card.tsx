import { deleteAccountAction, setAiConsentAction } from "@/app/actions/auth";
import type { User } from "@/lib/domain/types";
import { Card } from "./ui";

/** Privacy controls shared by customer and business accounts. */
export function PrivacyCard({ user, aiProvider }: { user: User; aiProvider: string }) {
  return (
    <Card title="Privacy & your data">
      <form action={setAiConsentAction} className="space-y-2">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="consent" defaultChecked={!!user.aiProcessingConsent} className="mt-1" />
          <span>
            Allow DealPilot to send my documents and negotiation details to our AI provider{aiProvider === "anthropic" ? " (Anthropic)" : ""} for analysis and drafting.
            Without this, analysis runs on DealPilot&apos;s servers with a simpler, offline method. You can change this at any time.
          </span>
        </label>
        <button className="btn-secondary" type="submit">Save</button>
      </form>
      <div className="mt-4 border-t border-slate-100 pt-4">
        <a className="btn-secondary" href="/api/account/export">Download my data (JSON)</a>
      </div>
      <details className="mt-4 border-t border-slate-100 pt-4">
        <summary className="cursor-pointer text-sm font-medium text-red-700">Delete my account</summary>
        <form action={deleteAccountAction} className="mt-3 space-y-2">
          <p className="text-sm text-slate-600">
            Removes your documents, monitoring and personal details and signs you out for good. Records of completed deals and fees are kept in anonymised form because the law requires
            financial records to be retained. Finish or cancel any pending deals first.
          </p>
          <input className="input" name="confirmEmail" placeholder="Type your email to confirm" autoComplete="off" required />
          <button className="btn-danger" type="submit">Permanently delete my account</button>
        </form>
      </details>
    </Card>
  );
}
