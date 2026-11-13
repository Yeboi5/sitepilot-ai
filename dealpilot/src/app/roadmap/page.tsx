import Link from "next/link";
import { Provenance } from "@/components/ui";
import { FEATURE_STATUS } from "@/lib/feature-status";

export const metadata = { title: "What's live" };

export default function Roadmap() {
  const areas = [...new Set(FEATURE_STATUS.map((f) => f.area))];
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link href="/" className="text-sm text-brand-700">← DealPilot</Link>
      <h1 className="mt-2 text-3xl font-bold">Live, simulated and future</h1>
      <p className="mt-2 text-slate-600">DealPilot never presents fictional offers, savings or negotiations as real. Here is exactly what works today.</p>
      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <span className="flex items-center gap-2"><Provenance kind="live" /> working on platform data</span>
        <span className="flex items-center gap-2"><Provenance kind="simulated" /> demonstration only</span>
        <span className="flex items-center gap-2"><Provenance kind="future" /> designed, not connected</span>
      </div>
      {areas.map((area) => (
        <section key={area} className="mt-8">
          <h2 className="text-lg font-semibold">{area}</h2>
          <ul className="mt-2 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
            {FEATURE_STATUS.filter((f) => f.area === area).map((f) => (
              <li key={f.feature} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div><p className="font-medium">{f.feature}</p><p className="text-sm text-slate-600">{f.note}</p></div>
                <div className="shrink-0"><Provenance kind={f.status} /></div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
