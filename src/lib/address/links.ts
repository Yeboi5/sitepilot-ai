import { isState, type State } from "@/lib/jurisdictions";

/**
 * Outbound links to listing portals. These are plain links that open the portal's own site;
 * SitePilot never copies their listing data, prices or photos (their terms forbid scraping, §9).
 */
function slug(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export type PortalLink = { name: string; href: string };

export function portalLinks(suburb: string, state: string, postcode: string): PortalLink[] {
  if (!isState(state) || !/^\d{4}$/.test(postcode) || !suburb.trim()) return [];
  const st = (state as State).toLowerCase();
  return [
    { name: "Domain", href: `https://www.domain.com.au/sale/${slug(suburb)}-${st}-${postcode}/` },
    {
      name: "realestate.com.au",
      href: `https://www.realestate.com.au/buy/in-${encodeURIComponent(`${slug(suburb).replace(/-/g, " ")}, ${st} ${postcode}`).replace(/%20/g, "+")}/list-1`,
    },
  ];
}
