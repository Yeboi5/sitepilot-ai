"use client";

import { Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { getListings } from "@/app/(public)/discover/actions";
import { readGuestDecisions, savedIds } from "@/lib/discovery/guest-store";

export type PropertyOption = { id: string; headline: string; suburb: string; state: string };

const MAX = 5;
const MIN = 2;

/**
 * Add, remove or replace properties without leaving Compare (brief §8). Options come from the
 * user's saved list (passed in for signed-in users; read from this device for guests).
 */
export function ManageProperties({
  current,
  colors,
  options: initialOptions,
  signedIn,
  onChange,
}: {
  current: PropertyOption[];
  colors: string[];
  options: PropertyOption[] | null;
  signedIn: boolean;
  onChange: (ids: string[]) => void;
}) {
  const [options, setOptions] = useState<PropertyOption[]>(initialOptions ?? []);
  useEffect(() => {
    if (signedIn || initialOptions) return;
    void getListings(savedIds(readGuestDecisions())).then((ls) => setOptions(ls.map((l) => ({ id: l.id, headline: l.headline, suburb: l.suburb, state: l.state }))));
  }, [signedIn, initialOptions]);

  const ids = current.map((c) => c.id);
  const available = options.filter((o) => !ids.includes(o.id));
  const select = "min-h-11 w-full rounded-xl border border-sand-300 bg-white px-3 text-sm";

  return (
    <section aria-labelledby="manage-heading" className="rounded-2xl border border-sand-200 bg-white p-4 print:hidden">
      <h2 id="manage-heading" className="font-display text-lg font-bold">
        Properties in this comparison
      </h2>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {current.map((c, i) => (
          <li key={c.id} className="space-y-2 rounded-xl border border-sand-200 p-3">
            <div className="flex items-start gap-2">
              <span aria-hidden="true" className="mt-1.5 inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: colors[i] }} />
              <span className="min-w-0 flex-1 text-sm">
                <span className="block font-semibold">{c.headline}</span>
                <span className="text-xs text-slate-500">
                  {c.suburb} {c.state}
                </span>
              </span>
              <button
                type="button"
                onClick={() => onChange(ids.filter((x) => x !== c.id))}
                disabled={ids.length <= MIN}
                title={ids.length <= MIN ? "A comparison needs at least 2 properties" : undefined}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-sand-100 hover:text-red-700 disabled:opacity-40"
              >
                <X aria-hidden="true" className="h-5 w-5" />
                <span className="sr-only">Remove {c.headline}</span>
              </button>
            </div>
            {available.length ? (
              <label className="block">
                <span className="sr-only">Replace {c.headline} with</span>
                <select className={select} value="" onChange={(e) => e.target.value && onChange(ids.map((x) => (x === c.id ? e.target.value : x)))}>
                  <option value="">Replace with…</option>
                  {available.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.headline} ({o.suburb})
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {ids.length < MAX && available.length ? (
          <label className="flex min-w-[14rem] flex-1 items-center gap-2">
            <Plus aria-hidden="true" className="h-4 w-4 shrink-0 text-brand-700" />
            <span className="sr-only">Add a saved property</span>
            <select className={select} value="" onChange={(e) => e.target.value && onChange([...ids, e.target.value])}>
              <option value="">Add a saved property…</option>
              {available.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.headline} ({o.suburb})
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="text-xs text-slate-500">
            {ids.length >= MAX ? "A comparison holds up to 5 properties." : "Save more properties in Discover to add them here."}
          </p>
        )}
      </div>
    </section>
  );
}
