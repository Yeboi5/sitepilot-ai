"use client";

import {
  Building2, FileText, Gavel, Inbox, LayoutDashboard, LineChart, MessagesSquare, PiggyBank, Receipt, Route, ScrollText,
  ShieldCheck, SlidersHorizontal, Users, type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS: Record<string, LucideIcon> = {
  Building2, FileText, Gavel, Inbox, LayoutDashboard, LineChart, MessagesSquare, PiggyBank, Receipt, Route, ScrollText, ShieldCheck, SlidersHorizontal, Users,
};

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  mobile?: boolean;
}

export function NavLinks({ items, variant }: { items: NavItem[]; variant: "side" | "bottom" }) {
  const path = usePathname();
  const root = items[0]?.href;
  return (
    <>
      {items.map((item) => {
        const Icon = ICONS[item.icon] ?? LayoutDashboard;
        const active = item.href === root ? path === root : path.startsWith(item.href);
        if (variant === "bottom") {
          return (
            <Link key={item.href} href={item.href} className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[11px] ${active ? "text-brand-700" : "text-slate-500"}`}>
              <Icon className="h-5 w-5" aria-hidden />
              <span className="truncate">{item.label.split(" ")[0]}</span>
            </Link>
          );
        }
        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${active ? "bg-brand-50 text-brand-800" : "text-slate-700 hover:bg-slate-100"}`}>
            <Icon className="h-4 w-4" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
