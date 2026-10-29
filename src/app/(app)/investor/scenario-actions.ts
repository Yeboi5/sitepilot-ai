"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { FORMULA_VERSION, calculate } from "@/lib/finance/feasibility";
import { parseAssumptionsForm } from "@/lib/finance/form";
import { requireOrg } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/validation";

const uuid = z.string().uuid();
const nameSchema = z.string().trim().min(1, "Give the scenario a name").max(120, "120 characters or fewer");

/**
 * Create (scenarioId = null) or update a scenario. Every save appends a scenario_results row
 * holding the assumptions, the result and the formula version, which is the change history.
 * RLS restricts both tables to the property's owning organisation.
 */
export async function saveScenario(
  propertyId: string,
  scenarioId: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireOrg("investor");
  if (!uuid.safeParse(propertyId).success || (scenarioId !== null && !uuid.safeParse(scenarioId).success)) {
    return { error: "Unknown property or scenario." };
  }

  const name = nameSchema.safeParse(formData.get("name"));
  const assumptions = parseAssumptionsForm(formData);
  if (!name.success || !assumptions.ok) {
    return {
      error: "Some values need attention.",
      fieldErrors: {
        ...(name.success ? {} : { name: name.error.issues.map((i) => i.message) }),
        ...(assumptions.ok ? {} : assumptions.fieldErrors),
      },
    };
  }

  const result = calculate(assumptions.data);
  const supabase = await createClient();

  let id = scenarioId;
  if (id === null) {
    const { data, error } = await supabase
      .from("scenarios")
      .insert({ property_id: propertyId, name: name.data, assumptions_json: assumptions.data, formula_version: FORMULA_VERSION })
      .select("id")
      .single();
    if (error || !data) return { error: "We couldn't save the scenario. Please try again." };
    id = data.id;
  } else {
    const { data, error } = await supabase
      .from("scenarios")
      .update({ name: name.data, assumptions_json: assumptions.data, formula_version: FORMULA_VERSION })
      .eq("id", id)
      .eq("property_id", propertyId)
      .select("id");
    if (error || !data?.length) return { error: "We couldn't save the scenario. Please try again." };
  }

  const { error: historyError } = await supabase.from("scenario_results").insert({
    scenario_id: id,
    formula_version: FORMULA_VERSION,
    result_json: { assumptions: assumptions.data, result },
  });
  if (historyError) return { error: "The scenario was saved but its history entry failed. Please save again." };

  revalidatePath(`/investor/properties/${propertyId}`);
  redirect(`/investor/properties/${propertyId}/scenarios/${id}`);
}

export async function deleteScenario(formData: FormData) {
  await requireOrg("investor");
  const propertyId = String(formData.get("propertyId") ?? "");
  const scenarioId = String(formData.get("scenarioId") ?? "");
  if (!uuid.safeParse(propertyId).success || !uuid.safeParse(scenarioId).success) return;
  const supabase = await createClient();
  await supabase.from("scenarios").delete().eq("id", scenarioId).eq("property_id", propertyId);
  revalidatePath(`/investor/properties/${propertyId}`);
  redirect(`/investor/properties/${propertyId}`);
}
