"use client";

import { useActionState } from "react";
import { addEvidence } from "../../actions";
import { fieldA11y, FormMessage, SubmitButton } from "@/components/form";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { EVIDENCE_SOURCE_LABELS, EVIDENCE_SOURCE_TYPES } from "@/lib/validation";

export function EvidenceForm({ propertyId, today }: { propertyId: string; today: string }) {
  const [state, action] = useActionState(addEvidence.bind(null, propertyId), undefined);
  const fe = state?.fieldErrors;
  return (
    <form action={action} className="space-y-4" noValidate key={state?.message ? "reset" : "form"}>
      <FormMessage state={state} />
      <Field id="title" label="Title" hint="e.g. Planning certificate issued by council" errors={fe?.title}>
        <Input {...fieldA11y("title", fe?.title, true)} required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="sourceType" label="Source type" errors={fe?.sourceType}>
          <Select {...fieldA11y("sourceType", fe?.sourceType)} defaultValue="planning_certificate">
            {EVIDENCE_SOURCE_TYPES.map((t) => (
              <option key={t} value={t}>
                {EVIDENCE_SOURCE_LABELS[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="fetchedAt" label="Date retrieved" errors={fe?.fetchedAt}>
          <Input {...fieldA11y("fetchedAt", fe?.fetchedAt)} type="date" max={today} defaultValue={today} required />
        </Field>
      </div>
      <Field id="sourceUrl" label="Official source URL" hint="Link to the issuing authority's record (https only)." errors={fe?.sourceUrl}>
        <Input {...fieldA11y("sourceUrl", fe?.sourceUrl, true)} type="url" placeholder="https://" required />
      </Field>
      <Field id="notes" label="Notes (optional)" errors={fe?.notes}>
        <Textarea {...fieldA11y("notes", fe?.notes)} rows={3} />
      </Field>
      <SubmitButton pendingLabel="Adding…">Add evidence</SubmitButton>
    </form>
  );
}
