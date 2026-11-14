import Link from "next/link";
import { Flash } from "@/components/ui";
import { demoMode } from "@/lib/config";
import { flash, type SearchParams } from "@/lib/page";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/store/seed";
import { demoSignInAction, signInAction } from "../actions/auth";

export const metadata = { title: "Sign in" };

export default async function SignIn({ searchParams }: { searchParams: SearchParams }) {
  const f = await flash(searchParams);
  const next = f.get("next") ?? "";
  const demo = demoMode();
  return (
    <div className="mx-auto grid min-h-screen max-w-5xl items-center gap-8 px-4 py-10 lg:grid-cols-2">
      <div>
        <Link href="/" className="mb-6 flex items-center gap-2 font-bold"><span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">D</span>DealPilot</Link>
        <h1 className="text-2xl font-bold">Sign in</h1>
        <Flash error={f.error} notice={f.notice} />
        <form action={signInAction} className="mt-4 space-y-4">
          <input type="hidden" name="next" value={next} />
          <div><label className="label" htmlFor="email">Email</label><input className="input" id="email" name="email" type="email" autoComplete="email" required /></div>
          <div><label className="label" htmlFor="password">Password</label><input className="input" id="password" name="password" type="password" autoComplete="current-password" required /></div>
          <button className="btn-primary w-full" type="submit">Sign in</button>
        </form>
        <p className="mt-4 text-sm text-slate-600">New here? <Link className="font-semibold text-brand-700" href="/sign-up">Create an account</Link></p>
      </div>
      {demo && (
        <div className="card">
          <h2 className="font-semibold">Demo accounts</h2>
          <p className="mt-1 text-sm text-slate-600">One click signs you in. Password for all: <code className="rounded bg-slate-100 px-1">{DEMO_PASSWORD}</code></p>
          <div className="mt-4 space-y-2">
            {DEMO_ACCOUNTS.map((a) => (
              <form key={a.email} action={demoSignInAction}>
                <input type="hidden" name="email" value={a.email} />
                <input type="hidden" name="next" value={next} />
                <button type="submit" className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left text-sm hover:border-brand-300 hover:bg-brand-50">
                  <span><span className="block font-medium">{a.label}</span><span className="text-xs text-slate-500">{a.email}</span></span>
                  <span className="text-xs font-semibold uppercase text-slate-500">{a.role}</span>
                </button>
              </form>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-500">See <Link href="/journeys" className="underline">demo journeys</Link> for step-by-step walkthroughs.</p>
        </div>
      )}
    </div>
  );
}
