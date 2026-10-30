"use client";

import { useId, useState } from "react";

/**
 * Before/after comparison (§5). A native range input drives the split, so it works with touch,
 * mouse, keyboard (arrow keys, Home/End) and screen readers.
 */
export function CompareSlider({ before, after, beforeAlt, afterAlt }: { before: string; after: string; beforeAlt: string; afterAlt: string }) {
  const [pos, setPos] = useState(50);
  const id = useId();
  return (
    <figure className="space-y-2">
      <div className="relative overflow-hidden rounded-2xl border border-sand-200 bg-sand-100">
        {/* eslint-disable-next-line @next/next/no-img-element -- private, dynamic image routes */}
        <img src={before} alt={beforeAlt} className="block w-full select-none" draggable={false} />
        <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={after} alt={afterAlt} className="block h-full w-full select-none object-cover" draggable={false} />
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-1 -translate-x-1/2 bg-white shadow" style={{ left: `${pos}%` }} />
        <span aria-hidden="true" className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-xs font-bold">
          Before
        </span>
        <span aria-hidden="true" className="absolute right-2 top-2 rounded-full bg-slate-900/80 px-2 py-0.5 text-xs font-bold text-white">
          AI concept
        </span>
      </div>
      <label htmlFor={id} className="block text-sm font-medium">
        Compare before and after
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-valuetext={`${100 - pos}% concept shown`}
        className="h-11 w-full accent-brand-600"
      />
    </figure>
  );
}
