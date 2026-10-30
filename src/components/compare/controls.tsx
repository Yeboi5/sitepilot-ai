"use client";

import { useEffect, useId, useState } from "react";

/** Number input that keeps the user's text while typing and reports only valid numbers. */
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  prefix,
  placeholder,
  allowEmpty = false,
  compact = false,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  prefix?: string;
  placeholder?: string;
  allowEmpty?: boolean;
  compact?: boolean;
}) {
  const id = useId();
  const [text, setText] = useState(value == null ? "" : String(value));
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setText((t) => (Number(t.replace(/[,$\s]/g, "")) === value ? t : value == null ? "" : String(value)));
  }, [value]);
  return (
    <label htmlFor={id} className={compact ? "block" : "block text-sm"}>
      <span className={compact ? "sr-only" : "mb-1 block font-medium text-slate-700"}>{label}</span>
      <span className="flex items-center rounded-xl border border-sand-300 bg-white focus-within:ring-2 focus-within:ring-brand-500 aria-[invalid=true]:border-red-500" aria-invalid={invalid}>
        {prefix ? <span className="pl-3 text-sm text-slate-500">{prefix}</span> : null}
        <input
          id={id}
          inputMode="decimal"
          value={text}
          placeholder={placeholder}
          aria-invalid={invalid}
          onChange={(e) => {
            const t = e.target.value;
            setText(t);
            const clean = t.replace(/[,$\s]/g, "");
            if (clean === "") {
              setInvalid(!allowEmpty);
              if (allowEmpty) onChange(undefined);
              return;
            }
            const n = Number(clean);
            const ok = Number.isFinite(n) && (min == null || n >= min) && (max == null || n <= max);
            setInvalid(!ok);
            if (ok) onChange(step >= 1 ? Math.round(n) : n);
          }}
          className="min-h-11 w-full min-w-0 rounded-xl bg-transparent px-3 text-sm outline-none"
        />
        {suffix ? <span className="pr-3 text-sm text-slate-500">{suffix}</span> : null}
      </span>
    </label>
  );
}

export function Slider({ label, value, onChange, min, max, step = 1, format }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; format: (v: number) => string }) {
  const id = useId();
  return (
    <div className="text-sm">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="font-medium text-slate-700">
          {label}
        </label>
        <output htmlFor={id} className="tabular-nums text-slate-900">
          {format(value)}
        </output>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} aria-valuetext={format(value)} onChange={(e) => onChange(Number(e.target.value))} className="h-11 w-full accent-brand-600" />
    </div>
  );
}

export function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-2xl bg-sand-100 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-11 rounded-xl px-4 text-sm font-semibold ${value === o.value ? "bg-white shadow-sm" : "text-slate-600"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
