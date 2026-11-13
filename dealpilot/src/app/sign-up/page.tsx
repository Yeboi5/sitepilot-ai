import Link from "next/link";
import { Flash } from "@/components/ui";
import { CATEGORIES } from "@/lib/domain/categories";
import { flash, type SearchParams } from "@/lib/page";
import { signUpAction } from "../actions/auth";

export const metadata = { title: "Create account" };

export default async function SignUp({ searchParams }: { searchParams: SearchParams }) {
  const f = await flash(searchParams);
  const role = f.get("role") === "business" ? "business" : "customer";
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <Link href="/" className="mb-6 flex items-center gap-2 font-bold"><span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">D</span>DealPilot</Link>
      <h1 className="text-2xl font-bold">Create your account</h1>
      <p className="mt-1 text-sm text-slate-600">Free to register and explore.</p>
      <Flash error={f.error} />
      <form action={signUpAction} className="mt-4 space-y-4">
        <fieldset className="grid grid-cols-2 gap-2">
          <legend className="label">I am a</legend>
          {(["customer", "business"] as const).map((r) => (
            <label key={r} className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
              <input type="radio" name="role" value={r} defaultChecked={r === role} /> {r === "customer" ? "Customer" : "Business"}
            </label>
          ))}
        </fieldset>
        <div><label className="label" htmlFor="name">Your name</label><input className="input" id="name" name="name" required /></div>
        <div><label className="label" htmlFor="email">Email</label><input className="input" id="email" name="email" type="email" required autoComplete="email" /></div>
        <div><label className="label" htmlFor="password">Password</label><input className="input" id="password" name="password" type="password" minLength={10} required autoComplete="new-password" /><p className="mt-1 text-xs text-slate-500">At least 10 characters.</p></div>
        <div><label className="label" htmlFor="region">Region</label><input className="input" id="region" name="region" placeholder="e.g. Sydney NSW" /></div>
        <details className="rounded-xl border border-slate-200 p-3" open={role === "business"}>
          <summary className="cursor-pointer text-sm font-medium">Business details (business accounts only)</summary>
          <div className="mt-3 space-y-3">
            <div><label className="label" htmlFor="businessName">Business name</label><input className="input" id="businessName" name="businessName" /></div>
            <div>
              <span className="label">Service categories</span>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {CATEGORIES.map((c) => <label key={c.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="categories" value={c.id} /> {c.name}</label>)}
              </div>
            </div>
          </div>
        </details>
        <button className="btn-primary w-full" type="submit">Create account</button>
      </form>
      <p className="mt-4 text-xs text-slate-500">In this prototype, accounts live in memory and reset when the server restarts unless Supabase is configured.</p>
    </div>
  );
}
