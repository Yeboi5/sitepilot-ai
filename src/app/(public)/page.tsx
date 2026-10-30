import { CheckCircle2 } from "lucide-react";
import { redirect } from "next/navigation";
import { ActionTiles } from "@/components/dashboard/action-tiles";
import { EntryCards } from "@/components/dashboard/entry-cards";
import { HeroIllustration } from "@/components/dashboard/hero-illustration";
import { YourProjects } from "@/components/dashboard/your-projects";
import { getSessionContext } from "@/lib/session";

const TRUST = [
  "Plain-English numbers, with every assumption shown",
  "Planning facts only from official sources you can check",
  "Legal issues reviewed by licensed professionals, never decided by AI",
];

const STEPS = [
  { title: "Discover", body: "Swipe through homes or investment opportunities. Save the ones you like." },
  { title: "Analyse", body: "Open a property workspace and model scenarios with your own assumptions." },
  { title: "Get it checked", body: "Bring in a licensed conveyancer to review the contract and title." },
];

/** Dashboard (Update Pack 1.1): the starting point for guests and signed-in users. */
export default async function DashboardPage() {
  const ctx = await getSessionContext();
  if (ctx?.active?.organisation.type === "professional") redirect("/firm");
  const firstName = ctx?.user.display_name.split(" ")[0];

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-4xl bg-gradient-to-br from-brand-50 via-white to-leaf-50 px-6 py-8 shadow-sm ring-1 ring-sand-200 sm:px-10 sm:py-12">
        <div className="grid items-center gap-6 md:grid-cols-[1.3fr_1fr]">
          <div>
            {firstName ? <p className="font-semibold text-brand-700">Welcome back, {firstName}</p> : null}
            <h1 className="mt-1 text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl">
              Find your place.
              <br />
              <span className="bg-gradient-to-r from-brand-600 to-leaf-600 bg-clip-text text-transparent">Discover its potential.</span>
            </h1>
            <p className="mt-4 max-w-xl text-lg text-slate-700">
              Explore homes and investment opportunities, see what a property could become, and bring in a licensed
              conveyancer when you&apos;re ready.
            </p>
          </div>
          <HeroIllustration className="mx-auto hidden w-full max-w-sm md:block" />
        </div>
      </section>

      <EntryCards />

      <section aria-labelledby="quick-actions" className="space-y-3">
        <h2 id="quick-actions" className="text-xl font-extrabold">
          Quick actions
        </h2>
        <ActionTiles />
      </section>

      {ctx?.active ? (
        <YourProjects orgId={ctx.active.organisation.id} />
      ) : (
        <section aria-labelledby="how-it-works" className="space-y-4">
          <h2 id="how-it-works" className="text-xl font-extrabold">
            How it works
          </h2>
          <ol className="grid gap-3 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-2xl border border-sand-200 bg-white p-5 shadow-sm">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 font-display font-extrabold text-brand-700">
                  {i + 1}
                </span>
                <h3 className="mt-3 font-display text-lg font-bold">{s.title}</h3>
                <p className="mt-1 text-sm text-slate-700">{s.body}</p>
              </li>
            ))}
          </ol>
          <p className="text-sm text-slate-600">
            Browse freely as a guest. Listings shown are clearly marked <strong>DEMO</strong> until we have licensed listing
            data. Create a free account to save properties and keep private projects.
          </p>
        </section>
      )}

      <ul className="grid gap-3 rounded-3xl bg-white p-5 ring-1 ring-sand-200 sm:grid-cols-3">
        {TRUST.map((t) => (
          <li key={t} className="flex gap-2 text-sm text-slate-700">
            <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0 text-leaf-600" />
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}
