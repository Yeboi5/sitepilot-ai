import { ArrowRight, Gavel, LineChart, MessagesSquare, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { CATEGORIES } from "@/lib/domain/categories";
import { feeConfig } from "@/lib/config";
import { formatMoney } from "@/lib/domain/money";

const FEATURES = [
  { icon: MessagesSquare, title: "AI negotiation", body: "Analyse bills and quotes, draft counteroffers, and stay in control with Advisory, Approval or Limited Autopilot modes." },
  { icon: Gavel, title: "Competitive bidding", body: "Post a request and compare offers on price, scope, warranty, credentials and completion time — not just a score." },
  { icon: Users, title: "Group buying", body: "Combine demand with neighbours to unlock volume pricing tiers from businesses." },
  { icon: LineChart, title: "Price monitoring", body: "Track purchases, bills, renewals and contract expiry using approved data sources only." },
  { icon: ShieldCheck, title: "Money Guardian", body: "Spot duplicate charges, forgotten subscriptions and price creep from statements you upload. Never asks for bank passwords." },
];

export default async function Home() {
  const user = await getCurrentUser();
  const fee = formatMoney(feeConfig().successFeeCents);
  const home = user ? (user.role === "business" ? "/biz" : user.role === "admin" ? "/admin" : "/app") : null;
  return (
    <div className="min-h-screen bg-white">
      <div className="bg-amber-100 px-4 py-1.5 text-center text-xs text-amber-900">Prototype — all people, businesses, offers and savings shown are fictional demo data.</div>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2 font-bold"><span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">D</span>DealPilot</div>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/roadmap" className="hidden text-slate-600 sm:inline">What&apos;s live</Link>
          <Link href="/journeys" className="text-slate-600">Demo journeys</Link>
          {home ? <Link href={home} className="btn-primary">Open dashboard</Link> : <Link href="/sign-in" className="btn-primary">Sign in</Link>}
        </nav>
      </header>
      <main>
        <section className="mx-auto max-w-6xl px-4 pb-12 pt-8 sm:pt-16">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">Universal AI savings & negotiation</p>
          <h1 className="mt-2 max-w-3xl text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">Never overpay again.</h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-600">
            Upload a quote, bill or contract. DealPilot finds what a fair price looks like, gets businesses competing for your job, and negotiates for you — only with your permission.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/sign-in" className="btn-primary px-5 py-3 text-base">Try the demo <ArrowRight className="h-4 w-4" /></Link>
            <Link href="/sign-up" className="btn-secondary px-5 py-3 text-base">Create an account</Link>
          </div>
          <p className="mt-4 text-sm text-slate-500">Free to join. A {fee} fee applies only when a saving is verified and the deal is completed. No saving, no fee.</p>
        </section>
        <section className="border-y border-slate-200 bg-slate-50">
          <div className="mx-auto grid max-w-6xl gap-4 px-4 py-12 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="card">
                <f.icon className="h-6 w-6 text-brand-600" aria-hidden />
                <h2 className="mt-3 font-semibold">{f.title}</h2>
                <p className="mt-1 text-sm text-slate-600">{f.body}</p>
              </div>
            ))}
            <div className="card border-brand-200 bg-brand-50">
              <h2 className="font-semibold">For businesses</h2>
              <p className="mt-1 text-sm text-slate-700">Receive qualified customer requests, draft bids with AI, negotiate in one inbox and publish volume offers to buying groups.</p>
              <Link href="/sign-up?role=business" className="mt-3 inline-flex text-sm font-semibold text-brand-700">Register your business →</Link>
            </div>
          </div>
        </section>
        <section className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="text-xl font-bold">One engine, every category</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {CATEGORIES.map((c) => <span key={c.id} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">{c.name}</span>)}
          </div>
        </section>
      </main>
      <footer className="border-t border-slate-200 px-4 py-6 text-center text-xs text-slate-500">
        DealPilot prototype. General information only — not financial, legal or insurance advice. <Link href="/roadmap" className="underline">Live vs simulated features</Link>
      </footer>
    </div>
  );
}
