import { LogOut } from "lucide-react";
import Link from "next/link";
import { switchOrganisation } from "@/app/org-actions";
import { Disclaimer } from "@/components/disclaimer";
import { Badge } from "@/components/ui";
import { ORG_VERIFICATION } from "@/lib/format";
import type { SessionContext } from "@/lib/session";
import { navItemsFor } from "./nav-items";
import { BottomNav, DesktopNav } from "./nav-links";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-display text-lg font-extrabold text-brand-900">
      <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-leaf-500 text-white">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M5.5 10v9.5h13V10" />
          <path d="M10 19.5v-5h4v5" />
        </svg>
      </span>
      SitePilot<span className="text-leaf-600">AI</span>
    </Link>
  );
}

export function OrgSwitcher({ ctx }: { ctx: SessionContext }) {
  if (ctx.memberships.length < 2 || !ctx.active) return null;
  return (
    <form action={switchOrganisation} className="flex items-center gap-2 text-sm">
      <label htmlFor="organisationId" className="sr-only">
        Organisation
      </label>
      <select
        id="organisationId"
        name="organisationId"
        defaultValue={ctx.active.organisation.id}
        className="min-h-11 rounded-xl border border-sand-300 bg-white px-2 text-sm"
      >
        {ctx.memberships.map((m) => (
          <option key={m.organisation.id} value={m.organisation.id}>
            {m.organisation.name}
          </option>
        ))}
      </select>
      <button type="submit" className="min-h-11 rounded-xl border border-sand-300 bg-white px-3 hover:bg-sand-100">
        Switch
      </button>
    </form>
  );
}

/**
 * Responsive application shell (Update Pack 1.1): top bar on desktop, bottom tab bar on mobile.
 * Works for guests (ctx = null), consumers/investors and conveyancing firms.
 */
export function AppShell({ ctx, children }: { ctx: SessionContext | null; children: React.ReactNode }) {
  const items = navItemsFor(ctx);
  const org = ctx?.active?.organisation;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-sand-200 bg-white/90 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-6">
            <Logo />
            <DesktopNav items={items} />
          </div>
          <div className="flex items-center gap-2 text-sm">
            {ctx ? (
              <>
                <div className="hidden md:block">
                  <OrgSwitcher ctx={ctx} />
                </div>
                {org?.type === "professional" ? (
                  <Badge tone={ORG_VERIFICATION[org.verification_status].tone}>{ORG_VERIFICATION[org.verification_status].label}</Badge>
                ) : null}
                <span className="hidden text-slate-600 lg:inline">{ctx.user.display_name}</span>
                <form action="/auth/sign-out" method="post">
                  <button
                    type="submit"
                    className="flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-slate-700 hover:bg-sand-100"
                  >
                    <LogOut aria-hidden="true" className="h-4 w-4" />
                    <span>Sign out</span>
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link href="/sign-in" className="hidden min-h-11 items-center rounded-xl px-3 font-semibold text-slate-700 hover:bg-sand-100 sm:flex">
                  Sign in
                </Link>
                <Link href="/sign-up" className="flex min-h-11 items-center rounded-xl bg-brand-600 px-4 font-semibold text-white hover:bg-brand-700">
                  Create account
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 sm:px-6 md:pb-10 md:pt-8">
        {children}
      </main>
      <footer className="mx-auto w-full max-w-6xl px-4 pb-28 sm:px-6 md:pb-8 print:hidden">
        <Disclaimer compact />
        <p className="mt-2 text-xs text-slate-500">
          <Link href="/about" className="underline">
            About SitePilot
          </Link>
        </p>
      </footer>
      <BottomNav items={items} />
    </div>
  );
}
