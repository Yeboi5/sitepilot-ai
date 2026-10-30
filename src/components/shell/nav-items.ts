import { FLAGS } from "@/lib/flags";
import type { SessionContext } from "@/lib/session";

export type NavIcon = "home" | "discover" | "analyse" | "projects" | "profile" | "inbox" | "review" | "signin";

/** Plain data so it can be passed to client components. `also` lists extra active prefixes. */
export type NavItem = { href: string; label: string; icon: NavIcon; exact?: boolean; also?: string[] };

/** Navigation for each audience (Update Pack 1.1): consumers/investors, firms, and guests. */
export function navItemsFor(ctx: SessionContext | null): NavItem[] {
  if (ctx?.active?.organisation.type === "professional") {
    return [
      { href: "/firm", label: "Inbox", icon: "inbox", exact: true, also: ["/firm/matters"] },
      { href: "/firm/review", label: "Review", icon: "review" },
      { href: "/settings", label: "Profile", icon: "profile" },
    ];
  }
  return [
    { href: "/", label: "Home", icon: "home", exact: true },
    ...(FLAGS.discovery ? [{ href: "/discover", label: "Discover", icon: "discover" as const }] : []),
    { href: "/analyse", label: "Analyse", icon: "analyse" },
    { href: "/investor/properties", label: "Projects", icon: "projects", also: ["/investor"] },
    ctx ? { href: "/settings", label: "Profile", icon: "profile" } : { href: "/sign-in", label: "Sign in", icon: "signin" },
  ];
}
