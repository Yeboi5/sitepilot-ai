import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { isState, type State } from "@/lib/jurisdictions";
import { normaliseQuery } from "./query";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type AddressResult = {
  recordId: string;
  streetAddress: string | null;
  suburb: string;
  state: State;
  postcode: string;
  isDemo: boolean;
};

/**
 * Address search behind a provider interface. Today: the demo property records. Next: the
 * national address file (G-NAF, open data from Geoscape) loaded into property_records, at which
 * point only this function changes.
 */
export interface AddressProvider {
  name: string;
  search(query: string, limit?: number): Promise<AddressResult[]>;
}

export function demoAddressProvider(supabase: Supabase): AddressProvider {
  return {
    name: "SitePilot demo addresses",
    async search(query, limit = 20) {
      const q = normaliseQuery(query);
      if (q.length < 2) return [];
      let req = supabase.from("property_records").select("id, street_address, suburb, state, postcode, is_demo").limit(limit);
      if (/^\d{4}$/.test(q)) {
        req = req.eq("postcode", q);
      } else {
        const stateWord = q.split(" ").find((w) => isState(w.toUpperCase()));
        const text = q
          .split(" ")
          .filter((w) => w !== stateWord)
          .join(" ");
        if (stateWord) req = req.eq("state", stateWord.toUpperCase());
        if (text) req = req.or(`suburb.ilike.%${text}%,street_address.ilike.%${text}%`);
      }
      const { data } = await req.order("state").order("suburb");
      return (data ?? []).map((r) => ({
        recordId: r.id,
        streetAddress: r.street_address,
        suburb: r.suburb,
        state: r.state as State,
        postcode: r.postcode,
        isDemo: r.is_demo,
      }));
    },
  };
}
