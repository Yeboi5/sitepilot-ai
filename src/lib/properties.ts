import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Load a property owned by the active organisation, or 404. RLS hides other tenants' rows, so
 * a property that exists elsewhere is indistinguishable from one that doesn't.
 */
export async function getOwnedPropertyOr404(supabase: Supabase, id: string, orgId: string) {
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { data } = await supabase
    .from("properties")
    .select("id, owner_org_id, address, suburb, postcode, lot_dp, jurisdiction, is_demo, created_at")
    .eq("id", id)
    .eq("owner_org_id", orgId)
    .maybeSingle();
  if (!data) notFound();
  return data;
}
