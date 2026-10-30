"use client";

import { useActionState } from "react";
import { addHome, addMaintenance, addNote, submitClaim } from "@/app/(app)/my-property/actions";
import { sendEnquiry } from "@/app/(public)/listings/[id]/enquiry-actions";
import { fieldA11y, FormMessage, SubmitButton } from "@/components/form";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { STATES, STATE_INFO } from "@/lib/jurisdictions";

type Prefill = { recordId?: string; address?: string; suburb?: string; state?: string; postcode?: string };

export function AddHomeForm({ prefill }: { prefill: Prefill }) {
  const [state, action] = useActionState(addHome, undefined);
  const fe = state?.fieldErrors;
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      {prefill.recordId ? <input type="hidden" name="recordId" value={prefill.recordId} /> : null}
      <Field id="nickname" label="Nickname (optional)" hint="e.g. Our place" errors={fe?.nickname}>
        <Input {...fieldA11y("nickname", fe?.nickname, true)} maxLength={60} />
      </Field>
      <Field id="address" label="Street address" errors={fe?.address}>
        <Input {...fieldA11y("address", fe?.address)} defaultValue={prefill.address} autoComplete="address-line1" required />
      </Field>
      <Field id="suburb" label="Suburb" errors={fe?.suburb}>
        <Input {...fieldA11y("suburb", fe?.suburb)} defaultValue={prefill.suburb} autoComplete="address-level2" required />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field id="state" label="State or territory" errors={fe?.state}>
          <Select {...fieldA11y("state", fe?.state)} defaultValue={prefill.state ?? "NSW"}>
            {STATES.map((s) => (
              <option key={s} value={s}>
                {s} · {STATE_INFO[s].name}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="postcode" label="Postcode" errors={fe?.postcode}>
          <Input {...fieldA11y("postcode", fe?.postcode)} defaultValue={prefill.postcode} inputMode="numeric" maxLength={4} required />
        </Field>
      </div>
      <p className="text-xs text-slate-500">Adding a home keeps it private to you. It doesn&apos;t claim ownership; you can do that next.</p>
      <SubmitButton pendingLabel="Adding…">Add to My Property</SubmitButton>
    </form>
  );
}

export function NoteForm({ ownedId }: { ownedId: string }) {
  const [state, action] = useActionState(addNote.bind(null, ownedId), undefined);
  const fe = state?.fieldErrors;
  return (
    <form action={action} className="space-y-2" key={state?.message ? Date.now() : "note"}>
      <Field id="body" label="New note" errors={fe?.body}>
        <Textarea {...fieldA11y("body", fe?.body)} rows={3} maxLength={4000} />
      </Field>
      <SubmitButton pendingLabel="Saving…">Save note</SubmitButton>
      {state?.error ? <FormMessage state={state} /> : null}
    </form>
  );
}

export function MaintenanceForm({ ownedId, today }: { ownedId: string; today: string }) {
  const [state, action] = useActionState(addMaintenance.bind(null, ownedId), undefined);
  const fe = state?.fieldErrors;
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-[1fr_10rem_auto] sm:items-end" key={state?.message ? Date.now() : "task"}>
      <Field id="title" label="Task" errors={fe?.title}>
        <Input {...fieldA11y("title", fe?.title)} maxLength={200} placeholder="e.g. Service the hot water system" />
      </Field>
      <Field id="dueOn" label="Due (optional)" errors={fe?.dueOn}>
        <Input {...fieldA11y("dueOn", fe?.dueOn)} type="date" min={today} />
      </Field>
      <SubmitButton pendingLabel="Adding…">Add</SubmitButton>
    </form>
  );
}

export function ClaimForm({ ownedId }: { ownedId: string }) {
  const [state, action] = useActionState(submitClaim.bind(null, ownedId), undefined);
  const fe = state?.fieldErrors;
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <Field
        id="evidence"
        label="Proof of ownership"
        hint="A recent council rates notice or similar showing your name and this address. PDF, JPG or PNG, up to 10 MB."
        errors={fe?.evidence}
      >
        <input
          {...fieldA11y("evidence", fe?.evidence, true)}
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          className="block w-full rounded-xl border border-sand-300 bg-white p-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:font-semibold file:text-brand-700"
        />
      </Field>
      <div>
        <label className="flex items-start gap-3 rounded-xl border border-sand-300 p-3 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
          <input type="checkbox" name="declaration" value="yes" className="mt-1 h-4 w-4" aria-describedby={fe?.declaration ? "declaration-error" : undefined} />
          <span>
            I declare that I own this property (or am authorised by the owner), and that the document I&apos;m uploading is
            genuine. I understand a SitePilot reviewer will look at it, and it will be deleted after the decision.
          </span>
        </label>
        {fe?.declaration ? (
          <p id="declaration-error" role="alert" className="mt-1 text-xs text-red-700">
            {fe.declaration.join(" ")}
          </p>
        ) : null}
      </div>
      <SubmitButton pendingLabel="Submitting…">Submit claim for review</SubmitButton>
    </form>
  );
}

export function EnquiryForm({ listingId }: { listingId: string }) {
  const [state, action] = useActionState(sendEnquiry.bind(null, listingId), undefined);
  const fe = state?.fieldErrors;
  if (state?.message) return <FormMessage state={state} />;
  return (
    <form action={action} className="space-y-3" noValidate>
      <FormMessage state={state} />
      <Field
        id="message"
        label="Message to the owner"
        hint="Introduce yourself and what you're looking for. Don't include phone numbers or emails; SitePilot passes messages on."
        errors={fe?.message}
      >
        <Textarea {...fieldA11y("message", fe?.message, true)} rows={4} maxLength={1000} />
      </Field>
      <SubmitButton pendingLabel="Sending…">Register interest</SubmitButton>
    </form>
  );
}
