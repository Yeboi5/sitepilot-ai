"use client";

import { useActionState } from "react";
import { createProperty } from "../../actions";
import { fieldA11y, FormMessage, SubmitButton } from "@/components/form";
import { Field, Input } from "@/components/ui";

export function PropertyForm() {
  const [state, action] = useActionState(createProperty, undefined);
  const fe = state?.fieldErrors;
  return (
    <form action={action} className="max-w-xl space-y-4" noValidate>
      <FormMessage state={state} />
      <Field id="address" label="Street address" errors={fe?.address}>
        <Input {...fieldA11y("address", fe?.address)} autoComplete="address-line1" placeholder="12 Example Street" required />
      </Field>
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <Field id="suburb" label="Suburb" errors={fe?.suburb}>
            <Input {...fieldA11y("suburb", fe?.suburb)} autoComplete="address-level2" required />
          </Field>
        </div>
        <Field id="postcode" label="Postcode" errors={fe?.postcode}>
          <Input {...fieldA11y("postcode", fe?.postcode)} autoComplete="postal-code" inputMode="numeric" maxLength={4} required />
        </Field>
      </div>
      <Field id="lotDp" label="Lot / DP (optional)" hint="As shown on the title search, e.g. Lot 1 DP 123456." errors={fe?.lotDp}>
        <Input {...fieldA11y("lotDp", fe?.lotDp, true)} />
      </Field>
      <p className="text-xs text-slate-500">Jurisdiction: NSW. Other states are not supported during the pilot.</p>
      <SubmitButton pendingLabel="Creating…">Create property</SubmitButton>
    </form>
  );
}
