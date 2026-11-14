import Link from "next/link";
import type { ReactNode } from "react";
import { formatMoney, type Cents } from "@/lib/domain/money";
import { STATE_LABELS } from "@/lib/domain/negotiation";
import type { NegotiationState, Provenance, Recurrence, TransactionStatus } from "@/lib/domain/types";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className, title, action }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={cx("card", className)}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold text-slate-900">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

const TONES = {
  green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  blue: "bg-sky-50 text-sky-800 ring-sky-200",
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  violet: "bg-violet-50 text-violet-800 ring-violet-200",
} as const;
export type Tone = keyof typeof TONES;

export function Badge({ children, tone = "slate", title }: { children: ReactNode; tone?: Tone; title?: string }) {
  return <span title={title} className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", TONES[tone])}>{children}</span>;
}

const PROV: Record<Provenance, { label: string; tone: Tone; title: string }> = {
  live: { label: "Live", tone: "green", title: "Working functionality operating on real platform data" },
  simulated: { label: "Simulated", tone: "amber", title: "Demonstration only — fictional counterparty, data or outcome" },
  future: { label: "Future integration", tone: "violet", title: "Designed but not yet connected to a real provider" },
};

export function Provenance({ kind, children }: { kind: Provenance; children?: ReactNode }) {
  const p = PROV[kind];
  return <Badge tone={p.tone} title={p.title}>{children ?? p.label}</Badge>;
}

export function Money({ cents, recurrence, className }: { cents: Cents; recurrence?: Recurrence; className?: string }) {
  const suffix = recurrence === "monthly" ? "/mo" : recurrence === "annual" ? "/yr" : recurrence === "weekly" ? "/wk" : recurrence === "quarterly" ? "/qtr" : "";
  return <span className={cx("tabular-nums", className)}>{formatMoney(cents)}{suffix && <span className="text-slate-500">{suffix}</span>}</span>;
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "brand" }) {
  return (
    <div className={cx("card", tone === "brand" && "border-brand-200 bg-brand-50")}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <p className="font-semibold text-slate-800">{title}</p>
      {children && <div className="mt-1 text-sm text-slate-600">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Flash({ error, notice }: { error?: string; notice?: string }) {
  if (!error && !notice) return null;
  return (
    <div role={error ? "alert" : "status"} data-flash={error ? "error" : "notice"} className={cx("mb-4 rounded-xl border px-4 py-3 text-sm", error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800")}>
      {error ?? notice}
    </div>
  );
}

export function Field({ label, name, children, hint }: { label: string; name?: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function LinkButton({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: "primary" | "secondary" }) {
  return <Link href={href} className={variant === "primary" ? "btn-primary" : "btn-secondary"}>{children}</Link>;
}

const STATE_TONE: Record<NegotiationState, Tone> = {
  open: "slate", awaiting_approval: "amber", awaiting_counterparty: "blue", counter_received: "amber", escalated: "red", final_approval: "amber",
  agreed: "violet", completed: "green", declined: "slate", cancelled: "slate", expired: "slate",
};
export function StateBadge({ state }: { state: NegotiationState }) {
  return <Badge tone={STATE_TONE[state]}>{STATE_LABELS[state]}</Badge>;
}

const TX_TONE: Record<TransactionStatus, [Tone, string]> = {
  pending_verification: ["amber", "Pending verification"], verified: ["green", "Verified"], rejected: ["red", "Rejected"], cancelled: ["slate", "Cancelled"],
};
export function TxBadge({ status }: { status: TransactionStatus }) {
  const [tone, label] = TX_TONE[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export function DemoNote({ children }: { children: ReactNode }) {
  return <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">{children}</p>;
}

export function relTime(iso: string, now = Date.now()) {
  const d = Math.round((new Date(iso).getTime() - now) / 86_400_000);
  if (d === 0) return "today";
  if (d === -1) return "yesterday";
  if (d === 1) return "tomorrow";
  return d < 0 ? `${-d} days ago` : `in ${d} days`;
}
