import { BadgeCheck, Bell, Calculator, Heart, Search, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { FLAGS } from "@/lib/flags";

type Tile = { href: string; label: string; hint: string; icon: LucideIcon };

export function ActionTiles() {
  const tiles: Tile[] = [
    { href: "/analyse", label: "Search address", hint: "Start with a property you know", icon: Search },
    { href: "/investor/properties", label: "Analyse a property", hint: "Open your projects", icon: Calculator },
    { href: "/saved", label: "Saved properties", hint: "Your shortlists", icon: Heart },
    ...(FLAGS.alerts ? [{ href: "/alerts", label: "Alerts", hint: "New matches for you", icon: Bell }] : []),
    ...(FLAGS.findAPro ? [{ href: "/pros", label: "Find a pro", hint: "Licensed conveyancers", icon: BadgeCheck }] : []),
  ];
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {tiles.map((t) => (
        <li key={t.href}>
          <Link
            href={t.href}
            className="flex h-full min-h-[96px] flex-col gap-2 rounded-2xl border border-sand-200 bg-white p-4 shadow-sm transition hover:border-brand-200 hover:shadow-md"
          >
            <t.icon aria-hidden="true" className="h-6 w-6 text-brand-600" />
            <span className="font-semibold text-slate-900">{t.label}</span>
            <span className="text-xs text-slate-600">{t.hint}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
