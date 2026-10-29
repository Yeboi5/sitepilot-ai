"use client";

import { useActionState } from "react";
import { createOrganisation } from "@/app/org-actions";
import { fieldA11y, FormMessage, SubmitButton } from "@/components/form";
import { Field, Input } from "@/components/ui";

export function OnboardingForm() {
  const [state, action] = useActionState(createOrganisation, undefined);
  const fe = state?.fieldErrors;
  return (
    <form action={action} className="space-y-5" noValidate>
      <FormMessage state={state} />
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-slate-800">I am setting up…</legend>
        <label className="flex cursor-pointer gap-3 rounded-lg border border-slate-300 p-3 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
          <input type="radio" name="type" value="investor" defaultChecked className="mt-1" />
          <span>
            <span className="block text-sm font-medium">An investor or developer workspace</span>
            <span className="block text-xs text-slate-600">Research properties, model scenarios and engage a conveyancer.</span>
          </span>
        </label>
        <label className="flex cursor-pointer gap-3 rounded-lg border border-slate-300 p-3 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
          <input type="radio" name="type" value="professional" className="mt-1" />
          <span>
            <span className="block text-sm font-medium">A conveyancing or law firm</span>
            <span className="block text-xs text-slate-600">
              Accept client matters and review documents. Professional credentials are verified manually during the pilot.
            </span>
          </span>
        </label>
        {fe?.type ? <p className="text-xs text-red-700">{fe.type.join(" ")}</p> : null}
      </fieldset>
      <Field id="name" label="Organisation name" errors={fe?.name}>
        <Input {...fieldA11y("name", fe?.name)} autoComplete="organization" required />
      </Field>
      <SubmitButton pendingLabel="Creating…">Continue</SubmitButton>
    </form>
  );
}
