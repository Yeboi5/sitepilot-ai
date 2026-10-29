import Link from "next/link";
import { Disclaimer } from "./disclaimer";

export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <nav aria-label="Main" className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold text-brand-900">
            SitePilot <span className="text-brand-600">AI</span>
          </Link>
          <div className="flex items-center gap-5 text-sm">
            <Link href="/pricing" className="text-slate-700 hover:text-slate-900">
              Pricing
            </Link>
            <Link href="/sign-in" className="text-slate-700 hover:text-slate-900">
              Sign in
            </Link>
            <Link href="/sign-up" className="rounded-lg bg-brand-600 px-3 py-1.5 font-medium text-white hover:bg-brand-700">
              Get started
            </Link>
          </div>
        </nav>
      </header>
      <main id="main" className="flex-1">
        {children}
      </main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <Disclaimer />
        </div>
      </footer>
    </div>
  );
}
