import { ArrowRight, HeartHandshake, TrendingUp } from "lucide-react";
import Link from "next/link";

/** The two primary journeys on the dashboard (Update Pack 1.1). */
export function EntryCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Link
        href="/discover/home"
        className="group relative overflow-hidden rounded-3xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-6 shadow-sm transition hover:shadow-md motion-safe:hover:-translate-y-0.5"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white">
          <HeartHandshake aria-hidden="true" className="h-6 w-6" />
        </span>
        <h2 className="mt-4 text-2xl font-extrabold text-brand-900">Find My Home</h2>
        <p className="mt-1 text-slate-700">Swipe through homes that fit your life: price, suburb, bedrooms and the things you love nearby.</p>
        <span className="mt-4 inline-flex items-center gap-1 font-semibold text-brand-700">
          Start exploring <ArrowRight aria-hidden="true" className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </span>
      </Link>
      <Link
        href="/discover/investment"
        className="group relative overflow-hidden rounded-3xl border border-leaf-100 bg-gradient-to-br from-leaf-50 to-white p-6 shadow-sm transition hover:shadow-md motion-safe:hover:-translate-y-0.5"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-leaf-600 text-white">
          <TrendingUp aria-hidden="true" className="h-6 w-6" />
        </span>
        <h2 className="mt-4 text-2xl font-extrabold text-leaf-700">Find My Investment</h2>
        <p className="mt-1 text-slate-700">Spot opportunities with clear, labelled numbers: price, indicative yield, cash flow and risks.</p>
        <span className="mt-4 inline-flex items-center gap-1 font-semibold text-leaf-700">
          Start exploring <ArrowRight aria-hidden="true" className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </span>
      </Link>
    </div>
  );
}
