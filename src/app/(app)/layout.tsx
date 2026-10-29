import Link from "next/link";
import { switchOrganisation } from "@/app/org-actions";
import { Disclaimer } from "@/components/disclaimer";
import { Badge } from "@/components/ui";
import { ORG_VERIFICATION } from "@/lib/format";
import { requireOrg } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireOrg();
  const org = ctx.active.organisation;
  const nav =
    org.type === "investor"
      ? [
          { href: "/investor", label: "Dashboard" },
          { href: "/investor/properties", label: "Properties" },
          { href: "/settings", label: "Settings" },
        ]
      : [
          { href: "/firm", label: "Matter inbox" },
          { href: "/firm/review", label: "Review queue" },
          { href: "/settings", label: "Settings" },
        ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="font-semibold text-brand-900">
              SitePilot <span className="text-brand-600">AI</span>
            </Link>
            <nav aria-label="Primary" className="flex gap-1 text-sm">
              {nav.map((item) => (
                <Link key={item.href} href={item.href} className="rounded-md px-3 py-1.5 text-slate-700 hover:bg-slate-100">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            {ctx.memberships.length > 1 ? (
              <form action={switchOrganisation} className="flex items-center gap-2">
                <label htmlFor="organisationId" className="sr-only">
                  Organisation
                </label>
                <select
                  id="organisationId"
                  name="organisationId"
                  defaultValue={org.id}
                  className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                >
                  {ctx.memberships.map((m) => (
                    <option key={m.organisation.id} value={m.organisation.id}>
                      {m.organisation.name}
                    </option>
                  ))}
                </select>
                <button type="submit" className="rounded-md border border-slate-300 px-2 py-1 hover:bg-slate-50">
                  Switch
                </button>
              </form>
            ) : (
              <span className="font-medium text-slate-800">{org.name}</span>
            )}
            {org.type === "professional" ? <Badge tone={ORG_VERIFICATION[org.verification_status].tone}>{ORG_VERIFICATION[org.verification_status].label}</Badge> : null}
            <span className="text-slate-500">{ctx.user.display_name}</span>
            <form action="/auth/sign-out" method="post">
              <button type="submit" className="rounded-md px-2 py-1 text-slate-700 hover:bg-slate-100">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        {children}
      </main>
      <footer className="mx-auto w-full max-w-6xl px-6 pb-6">
        <Disclaimer compact />
      </footer>
    </div>
  );
}
