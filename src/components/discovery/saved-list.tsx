"use client";

import { LayoutGrid, List, Scale } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Listing } from "@/lib/discovery/types";
import { FLAGS } from "@/lib/flags";
import { STATES } from "@/lib/jurisdictions";
import { SavedItem } from "./saved-item";

const MAX = 5;

/**
 * Saved Properties with Compare (Blueprint v2.1): grid/list, filters, select 2–5, and a sticky
 * Compare action. Selection is kept in this component only.
 */
export function SavedList({ listings, onRemove }: { listings: Listing[]; onRemove?: (id: string) => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [layout, setLayout] = useState<"list" | "grid">("list");
  const [state, setState] = useState("");
  const [market, setMarket] = useState("");
  const shown = useMemo(() => listings.filter((l) => (!state || l.state === state) && (!market || l.market === market)), [listings, state, market]);
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < MAX ? [...s, id] : s));
  const states = STATES.filter((s) => listings.some((l) => l.state === s));
  const select = "min-h-11 rounded-xl border border-sand-300 bg-white px-3 text-sm";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm">
          <span className="sr-only">Filter by state</span>
          <select value={state} onChange={(e) => setState(e.target.value)} className={select}>
            <option value="">All states</option>
            {states.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="sr-only">Filter by market</span>
          <select value={market} onChange={(e) => setMarket(e.target.value)} className={select}>
            <option value="">For sale and off-market</option>
            <option value="for_sale">For sale</option>
            <option value="off_market">Off-market (not for sale)</option>
          </select>
        </label>
        <div role="radiogroup" aria-label="Layout" className="ml-auto inline-flex rounded-xl bg-sand-100 p-1">
          {(["list", "grid"] as const).map((v) => (
            <button key={v} type="button" role="radio" aria-checked={layout === v} onClick={() => setLayout(v)} className={`flex h-9 w-10 items-center justify-center rounded-lg ${layout === v ? "bg-white shadow-sm" : "text-slate-600"}`}>
              {v === "list" ? <List aria-hidden="true" className="h-4 w-4" /> : <LayoutGrid aria-hidden="true" className="h-4 w-4" />}
              <span className="sr-only">{v === "list" ? "List view" : "Grid view"}</span>
            </button>
          ))}
        </div>
      </div>
      {FLAGS.compare ? <p className="text-xs text-slate-500">Tick 2 to 5 properties to compare them side by side.</p> : null}
      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-sand-300 bg-white p-6 text-center text-sm text-slate-600">No saved properties match these filters.</p>
      ) : (
        <ul className={layout === "grid" ? "grid grid-cols-2 gap-3 sm:grid-cols-3" : "space-y-3"}>
          {shown.map((l) => (
            <SavedItem
              key={l.id}
              listing={l}
              layout={layout}
              onRemove={onRemove ? () => onRemove(l.id) : undefined}
              select={
                FLAGS.compare
                  ? { checked: selected.includes(l.id), disabled: !selected.includes(l.id) && selected.length >= MAX, onChange: () => toggle(l.id) }
                  : undefined
              }
            />
          ))}
        </ul>
      )}
      {FLAGS.compare && selected.length > 0 ? (
        <div className="sticky bottom-24 z-30 md:bottom-4" role="region" aria-label="Compare selection">
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-900 p-3 text-white shadow-lg">
            <p className="text-sm" aria-live="polite">
              {selected.length} selected{selected.length >= MAX ? " (maximum)" : selected.length < 2 ? ": choose at least 2" : ""}
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setSelected([])} className="min-h-11 rounded-xl px-3 text-sm font-semibold underline">
                Clear
              </button>
              {selected.length >= 2 ? (
                <Link href={`/compare?ids=${selected.join(",")}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-white px-4 text-sm font-bold text-slate-900">
                  <Scale aria-hidden="true" className="h-4 w-4" /> Compare ({selected.length})
                </Link>
              ) : (
                <span aria-disabled="true" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-white/40 px-4 text-sm font-bold">
                  <Scale aria-hidden="true" className="h-4 w-4" /> Compare
                </span>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
