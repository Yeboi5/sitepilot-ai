"use client";

import { useActionState } from "react";
import { signIn } from "@/app/auth/actions";
import { fieldA11y, FormMessage, SubmitButton } from "@/components/form";
import { Field, Input } from "@/components/ui";

export function SignInForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signIn, undefined);
  const fe = state?.fieldErrors;
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="next" value={next ?? ""} />
      <Field id="email" label="Email" errors={fe?.email}>
        <Input {...fieldA11y("email", fe?.email)} type="email" autoComplete="email" required />
      </Field>
      <Field id="password" label="Password" errors={fe?.password}>
        <Input {...fieldA11y("password", fe?.password)} type="password" autoComplete="current-password" required />
      </Field>
      <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
    </form>
  );
}
