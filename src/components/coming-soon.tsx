import { ArrowLeft, Sparkles } from "lucide-react";
import { ButtonLink } from "./ui";

/** Friendly placeholder for screens scheduled in a later phase of Update Pack 1.1. */
export function ComingSoon({ title, children, points }: { title: string; children: React.ReactNode; points?: string[] }) {
  return (
    <div className="mx-auto max-w-2xl py-6 text-center sm:py-12">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-100 to-leaf-100 text-brand-700">
        <Sparkles aria-hidden="true" className="h-7 w-7" />
      </span>
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight">{title}</h1>
      <div className="mt-3 text-slate-700">{children}</div>
      {points?.length ? (
        <ul className="mx-auto mt-6 max-w-md space-y-2 rounded-2xl border border-sand-200 bg-white p-5 text-left text-sm text-slate-700">
          {points.map((p) => (
            <li key={p} className="flex gap-2">
              <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-leaf-500" />
              {p}
            </li>
          ))}
        </ul>
      ) : null}
      <ButtonLink href="/" variant="secondary" className="mt-8">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Back to home
      </ButtonLink>
    </div>
  );
}
