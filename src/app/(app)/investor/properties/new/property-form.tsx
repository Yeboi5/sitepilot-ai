"use client";

import { useActionState } from "react";
import { createProperty } from "../../actions";
import { fieldA11y, FormMessage, SubmitButton } from "@/components/form";
import { Field, Input, Select } from "@/components/ui";
import { FLAGS } from "@/lib/flags";
import { STATES, STATE_INFO } from "@/lib/jurisdictions";

export type PropertyDefaults = Partial<Record<"address" | "suburb" | "state" | "postcode", string>>;

export function PropertyForm({ defaults = {} }: { defaults?: PropertyDefaults }) {
  const [state, action] = useActionState(createProperty, undefined);
  const fe = state?.fieldErrors;
  return (
    <form action={action} className="max-w-xl space-y-4" noValidate>
      <FormMessage state={state} />
      <Field id="address" label="Street address" errors={fe?.address}>
        <Input {...fieldA11y("address", fe?.address)} autoComplete="address-line1" placeholder="12 Example Street" defaultValue={defaults.address} required />
      </Field>
      <Field id="suburb" label="Suburb" errors={fe?.suburb}>
        <Input {...fieldA11y("suburb", fe?.suburb)} autoComplete="address-level2" defaultValue={defaults.suburb} required />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        {FLAGS.nationwide ? (
          <Field id="state" label="State or territory" errors={fe?.state}>
            <Select {...fieldA11y("state", fe?.state)} autoComplete="address-level1" defaultValue={defaults.state ?? "NSW"}>
              {STATES.map((s) => (
                <option key={s} value={s}>
                  {s} · {STATE_INFO[s].name}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <input type="hidden" name="state" value="NSW" />
        )}
        <Field id="postcode" label="Postcode" errors={fe?.postcode}>
          <Input {...fieldA11y("postcode", fe?.postcode)} autoComplete="postal-code" inputMode="numeric" maxLength={4} defaultValue={defaults.postcode} required />
        </Field>
      </div>
      <Field
        id="lotDp"
        label="Lot and plan (optional)"
        hint="As shown on the title, e.g. Lot 1 DP 123456 (NSW), Lot 2 PS 123456 (VIC) or Lot 3 RP 12345 (QLD)."
        errors={fe?.lotDp}
      >
        <Input {...fieldA11y("lotDp", fe?.lotDp, true)} />
      </Field>
      {FLAGS.nationwide ? null : <p className="text-xs text-slate-500">Jurisdiction: NSW.</p>}
      <SubmitButton pendingLabel="Creating…">Create property</SubmitButton>
    </form>
  );
}
