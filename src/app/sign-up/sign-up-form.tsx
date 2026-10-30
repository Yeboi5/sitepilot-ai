"use client";

import { useActionState } from "react";
import { signUp } from "@/app/auth/actions";
import { fieldA11y, FormMessage, SubmitButton } from "@/components/form";
import { Field, Input } from "@/components/ui";

export function SignUpForm() {
  const [state, action] = useActionState(signUp, undefined);
  const fe = state?.fieldErrors;
  if (state?.message) return <FormMessage state={state} />;
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <Field id="displayName" label="Your name" errors={fe?.displayName}>
        <Input {...fieldA11y("displayName", fe?.displayName)} autoComplete="name" required />
      </Field>
      <Field id="email" label="Email" errors={fe?.email}>
        <Input {...fieldA11y("email", fe?.email)} type="email" autoComplete="email" required />
      </Field>
      <Field id="password" label="Password" hint="At least 12 characters, including a letter and a number." errors={fe?.password}>
        <Input {...fieldA11y("password", fe?.password, true)} type="password" autoComplete="new-password" required />
      </Field>
      <label className="flex items-start gap-3 rounded-xl border border-sand-300 p-3 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
        <input type="checkbox" name="accountType" value="professional" className="mt-1 h-4 w-4" />
        <span>
          <span className="block font-medium">I&apos;m setting up a conveyancing or law firm</span>
          <span className="block text-xs text-slate-600">Leave unticked if you&apos;re buying or investing. You&apos;ll get a personal workspace straight away.</span>
        </span>
      </label>
      <SubmitButton pendingLabel="Creating account…">Create account</SubmitButton>
    </form>
  );
}
