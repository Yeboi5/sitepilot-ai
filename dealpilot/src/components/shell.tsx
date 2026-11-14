import Link from "next/link";
import type { ReactNode } from "react";
import type { User } from "@/lib/domain/types";
import { signOutAction } from "@/app/actions/auth";
import { NavLinks, type NavItem } from "./nav-links";

export const CUSTOMER_NAV: NavItem[] = [
  { href: "/app", label: "Dashboard", icon: "LayoutDashboard", mobile: true },
  { href: "/app/requests", label: "Requests & bids", icon: "Gavel", mobile: true },
  { href: "/app/negotiations", label: "Negotiations", icon: "MessagesSquare", mobile: true },
  { href: "/app/documents", label: "Documents", icon: "FileText" },
  { href: "/app/groups", label: "Group buying", icon: "Users" },
  { href: "/app/monitor", label: "Price monitor", icon: "LineChart", mobile: true },
  { href: "/app/energy", label: "Energy plans", icon: "Zap" },
  { href: "/app/guardian", label: "Money Guardian", icon: "ShieldCheck" },
  { href: "/app/savings", label: "Savings & ledger", icon: "PiggyBank", mobile: true },
  { href: "/app/settings", label: "AI permissions", icon: "SlidersHorizontal" },
];

export const BUSINESS_NAV: NavItem[] = [
  { href: "/biz", label: "Dashboard", icon: "LayoutDashboard", mobile: true },
  { href: "/biz/requests", label: "Customer requests", icon: "Inbox", mobile: true },
  { href: "/biz/inbox", label: "Negotiations", icon: "MessagesSquare", mobile: true },
  { href: "/biz/groups", label: "Bulk offers", icon: "Users", mobile: true },
  { href: "/biz/transactions", label: "Transactions", icon: "Receipt", mobile: true },
  { href: "/biz/verification", label: "Verification", icon: "BadgeCheck" },
  { href: "/biz/profile", label: "Business profile", icon: "Building2" },
];

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Audit & ledger", icon: "ScrollText", mobile: true },
  { href: "/admin/businesses", label: "Business verification", icon: "BadgeCheck", mobile: true },
  { href: "/journeys", label: "Demo journeys", icon: "Route", mobile: true },
];

export function Shell({ user, nav, portal, children }: { user: User; nav: NavItem[]; portal: string; children: ReactNode }) {
  return (
    <div className="min-h-screen pb-20 lg:pb-0">
      <div className="bg-amber-100 px-4 py-1.5 text-center text-xs text-amber-900">
        Prototype with fictional demo data. Items marked <strong>Simulated</strong> are not real offers, providers or savings.{" "}
        <Link href="/roadmap" className="underline">What&apos;s live?</Link>
      </div>
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-bold text-slate-900">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">D</span>
            <span>DealPilot</span>
            <span className="hidden rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600 sm:inline">{portal}</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/journeys" className="hidden text-slate-600 hover:text-slate-900 sm:inline">Demo journeys</Link>
            <span className="hidden text-slate-600 md:inline">{user.name}</span>
            <form action={signOutAction}>
              <button className="btn-secondary px-3 py-1.5" type="submit">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        <aside className="hidden w-56 shrink-0 lg:block">
          <nav className="sticky top-20 space-y-1"><NavLinks items={nav} variant="side" /></nav>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white lg:hidden">
        <div className="mx-auto flex max-w-xl justify-around"><NavLinks items={nav.filter((n) => n.mobile)} variant="bottom" /></div>
      </nav>
    </div>
  );
}
