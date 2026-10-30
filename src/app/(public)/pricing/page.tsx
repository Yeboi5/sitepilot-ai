import type { Metadata } from "next";
import { Alert, ButtonLink, Card } from "@/components/ui";
import { METERING_NOTE, PLANS } from "@/lib/billing/plans";

export const metadata: Metadata = { title: "Pricing" };

const aud = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });

export default function PricingPage() {
  return (
    <>
      <div className="py-6 sm:py-10">
        <h1 className="text-3xl font-semibold tracking-tight">Pricing</h1>
        <p className="mt-2 text-slate-600">Indicative pilot pricing in AUD. {METERING_NOTE}</p>
        <div className="mt-4">
          <Alert tone="warning">Billing is not live. No payments are taken during the pilot.</Alert>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => (
            <Card key={plan.tier} className="flex flex-col">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {plan.audience === "investor" ? "Investors" : "Conveyancing firms"}
              </p>
              <h2 className="mt-1 text-lg font-semibold">{plan.name}</h2>
              <p className="mt-2 text-3xl font-semibold">
                {plan.monthlyAud === 0 ? "Free" : aud.format(plan.monthlyAud)}
                {plan.monthlyAud > 0 ? (
                  <span className="text-sm font-normal text-slate-500"> /month{plan.pricingNote ? ` ${plan.pricingNote}` : ""}</span>
                ) : null}
              </p>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-700">
                {plan.features.map((f) => (
                  <li key={f}>• {f}</li>
                ))}
              </ul>
              <ButtonLink href="/sign-up" variant="secondary" className="mt-6">
                Join the pilot
              </ButtonLink>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
