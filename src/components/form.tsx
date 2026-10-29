"use client";

import { useFormStatus } from "react-dom";
import { Alert, Button } from "./ui";
import type { FormState } from "@/lib/validation";

export function SubmitButton({ children, pendingLabel }: { children: React.ReactNode; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-disabled={pending}>
      {pending ? (pendingLabel ?? "Saving…") : children}
    </Button>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (state?.error) return <Alert tone="danger">{state.error}</Alert>;
  if (state?.message) return <Alert>{state.message}</Alert>;
  return null;
}

/** Props that wire an input to its error/hint text for screen readers. */
export function fieldA11y(id: string, errors?: string[], hasHint = false) {
  const describedBy = errors?.length ? `${id}-error` : hasHint ? `${id}-hint` : undefined;
  return { id, name: id, "aria-invalid": errors?.length ? true : undefined, "aria-describedby": describedBy } as const;
}
