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
      <SubmitButton pendingLabel="Creating account…">Create account</SubmitButton>
    </form>
  );
}
