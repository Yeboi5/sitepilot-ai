"use client";

import { useActionState } from "react";
import { createProject, generateConcept } from "@/app/(app)/vision/actions";
import { fieldA11y, FormMessage, SubmitButton } from "@/components/form";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { MODES, PRESETS, STYLES, type VisionMode } from "@/lib/vision/presets";

const fileClass =
  "block w-full rounded-xl border border-sand-300 bg-white p-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:font-semibold file:text-brand-700";
const choice =
  "flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-sand-300 bg-white p-3 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-500";

function Errors({ id, errors }: { id: string; errors?: string[] }) {
  return errors ? (
    <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-red-700">
      {errors.join(" ")}
    </p>
  ) : null;
}

export function NewProjectForm({ homes, defaultHome }: { homes: { id: string; label: string }[]; defaultHome?: string }) {
  const [state, action] = useActionState(createProject, undefined);
  const fe = state?.fieldErrors;
  return (
    <form action={action} className="space-y-5" noValidate>
      <FormMessage state={state} />
      <Field id="title" label="Project name" hint="e.g. Backyard pool idea" errors={fe?.title}>
        <Input {...fieldA11y("title", fe?.title, true)} maxLength={80} required />
      </Field>
      <fieldset aria-describedby={fe?.mode ? "mode-error" : undefined}>
        <legend className="mb-2 text-sm font-medium">What does the photo show?</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {(Object.keys(MODES) as VisionMode[]).map((m) => (
            <label key={m} className={choice}>
              <input type="radio" name="mode" value={m} defaultChecked={m === "birds_eye"} className="mt-1" />
              <span>
                <span className="block font-semibold">{MODES[m].label}</span>
                <span className="text-xs text-slate-600">{MODES[m].hint}</span>
              </span>
            </label>
          ))}
        </div>
        <Errors id="mode" errors={fe?.mode} />
      </fieldset>
      {homes.length ? (
        <Field id="homeId" label="Link to one of your homes (optional)" errors={fe?.homeId}>
          <Select {...fieldA11y("homeId", fe?.homeId)} defaultValue={defaultHome ?? ""}>
            <option value="">Not linked</option>
            {homes.map((h) => (
              <option key={h.id} value={h.id}>
                {h.label}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <Field id="photo" label="Photo" hint="JPG, PNG or WebP, up to 15 MB. We remove location and camera details before saving it." errors={fe?.photo}>
        <input {...fieldA11y("photo", fe?.photo, true)} type="file" accept="image/jpeg,image/png,image/webp" className={fileClass} />
      </Field>
      <div>
        <label className={choice}>
          <input type="checkbox" name="rights" value="yes" className="mt-1 h-4 w-4" aria-describedby={fe?.rights ? "rights-error" : undefined} />
          <span>
            I took this photo or have permission to use it, and it doesn&apos;t show people who haven&apos;t agreed. I won&apos;t upload
            listing photos or images I don&apos;t have rights to.
          </span>
        </label>
        <Errors id="rights" errors={fe?.rights} />
      </div>
      <SubmitButton pendingLabel="Uploading…">Create project</SubmitButton>
    </form>
  );
}

export function GenerateForm({ projectId, mode, creditsLeft }: { projectId: string; mode: VisionMode; creditsLeft: number }) {
  const [state, action] = useActionState(generateConcept.bind(null, projectId), undefined);
  const fe = state?.fieldErrors;
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <fieldset aria-describedby={fe?.preset ? "preset-error" : undefined}>
        <legend className="mb-2 text-sm font-medium">Idea</legend>
        <div className="flex flex-wrap gap-2">
          {PRESETS[mode].map((p, i) => (
            <label key={p.id} className="cursor-pointer">
              <input type="radio" name="preset" value={p.id} defaultChecked={i === 0} className="peer sr-only" />
              <span className="inline-flex min-h-11 items-center rounded-full border border-sand-300 bg-white px-4 text-sm font-semibold peer-checked:border-brand-600 peer-checked:bg-brand-600 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 peer-focus-visible:ring-offset-2">
                {p.label}
              </span>
            </label>
          ))}
        </div>
        <Errors id="preset" errors={fe?.preset} />
      </fieldset>
      <Field id="style" label="Style" errors={fe?.style}>
        <Select {...fieldA11y("style", fe?.style)} defaultValue="modern">
          {STYLES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="prompt" label="Describe it (optional)" hint="e.g. a small plunge pool with timber decking. Saved with the version." errors={fe?.prompt}>
        <Textarea {...fieldA11y("prompt", fe?.prompt, true)} rows={2} maxLength={300} />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Creating concept…">Create concept</SubmitButton>
        <span className="text-sm text-slate-600">{creditsLeft} of 10 left today</span>
      </div>
    </form>
  );
}
