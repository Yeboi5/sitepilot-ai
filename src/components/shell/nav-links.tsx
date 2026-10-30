"use client";

import { Briefcase, ClipboardCheck, Compass, Home, Inbox, LineChart, LogIn, UserRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavIcon, NavItem } from "./nav-items";

const ICONS: Record<NavIcon, LucideIcon> = {
  home: Home,
  discover: Compass,
  analyse: LineChart,
  projects: Briefcase,
  profile: UserRound,
  inbox: Inbox,
  review: ClipboardCheck,
  signin: LogIn,
};

export function isActive(item: NavItem, path: string) {
  if (item.exact) return path === item.href || (item.also ?? []).some((p) => path === p || path.startsWith(`${p}/`));
  return [item.href, ...(item.also ?? [])].some((p) => path === p || path.startsWith(`${p}/`));
}

export function DesktopNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Primary" className="hidden items-center gap-1 text-sm md:flex">
      {/* Guests have Sign in / Create account buttons in the header, so skip the tab here. */}
      {items.filter((item) => item.icon !== "signin").map((item) => {
        const active = isActive(item, path);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-4 py-2 font-medium transition-colors ${
              active ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-sand-100"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-sand-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden print:hidden"
    >
      <ul className="mx-auto flex max-w-lg">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          const active = isActive(item, path);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[60px] flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors ${
                  active ? "text-brand-700" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <span className={`flex h-8 w-12 items-center justify-center rounded-full ${active ? "bg-brand-100" : ""}`}>
                  <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
