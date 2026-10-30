"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { EMPTY_ASSUMPTIONS, type Assumptions } from "@/lib/finance/assumptions";
import { FORMULA_VERSION } from "@/lib/finance/feasibility";
import { isState } from "@/lib/jurisdictions";
import { requireOrg } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

/**
 * "Analyse this deal" (Blueprint v2.1, stage C6): opens the investor workspace for a for-sale
 * listing, creating one linked to the listing's property record if needed, with a starter
 * develop-and-sell scenario whose land cost is the asking price. The investor then adds official
 * planning evidence and their own costs; Compare scores development only after that.
 * Off-market homes aren't for sale, so they can't be analysed as a deal.
 */
export async function analyseListing(formData: FormData) {
  const ctx = await requireOrg("investor");
  const id = z.string().uuid().safeParse(formData.get("listingId"));
  if (!id.success) redirect("/discover/investment");
  const supabase = await createClient();
  const { data: listing } = await supabase
    .from("listings")
    .select("id, market, headline, street_address, suburb, state, postcode, asking_price, property_record_id")
    .eq("id", id.data)
    .maybeSingle();
  if (!listing || listing.market !== "for_sale" || !listing.street_address || !listing.property_record_id || !isState(listing.state)) {
    redirect(`/listings/${id.data}`);
  }

  // Reuse this organisation's workspace for the same property if there is one.
  const { data: existing } = await supabase
    .from("properties")
    .select("id")
    .eq("owner_org_id", ctx.active.organisation.id)
    .eq("property_record_id", listing.property_record_id)
    .limit(1)
    .maybeSingle();
  if (existing) redirect(`/investor/properties/${existing.id}`);

  const { data: workspace, error } = await supabase
    .from("properties")
    .insert({
      owner_org_id: ctx.active.organisation.id,
      address: listing.street_address,
      suburb: listing.suburb,
      postcode: listing.postcode,
      jurisdiction: listing.state,
      property_record_id: listing.property_record_id,
    })
    .select("id")
    .single();
  if (error || !workspace) redirect(`/listings/${listing.id}?analyse=failed`);

  const starter: Assumptions = { ...EMPTY_ASSUMPTIONS, land: { basis: "purchase_price", amount: listing.asking_price ?? 0 } };
  await supabase.from("scenarios").insert({
    property_id: workspace.id,
    name: "Starter from listing (add your costs)",
    assumptions_json: starter,
    formula_version: FORMULA_VERSION,
  });
  revalidatePath("/investor");
  redirect(`/investor/properties/${workspace.id}?from=listing`);
}
