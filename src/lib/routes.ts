// Guests may browse "/", "/about", "/discover/*" and other public pages; these need an account.
const PROTECTED_PREFIXES = ["/dashboard", "/investor", "/firm", "/settings", "/onboarding", "/analyse", "/my-property", "/verify"];

export function isProtectedPath(pathname: string): boolean {
  // Vision: the intro page and shared links are public; projects need an account.
  if (pathname.startsWith("/vision/")) return !pathname.startsWith("/vision/shared/");
  // Compare: /compare?ids= works for guests; saved comparisons need an account; shared links don't.
  if (pathname.startsWith("/compare/")) return !pathname.startsWith("/compare/shared/");
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Only allow same-origin relative redirects (prevents open-redirects via ?next=). */
export function safeNextPath(next: unknown, fallback = "/dashboard"): string {
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  try {
    const url = new URL(next, "http://localhost");
    if (url.origin !== "http://localhost") return fallback;
    return url.pathname + url.search;
  } catch {
    return fallback;
  }
}
