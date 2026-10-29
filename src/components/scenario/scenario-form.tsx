"use client";

import { useActionState, useState } from "react";
import { saveScenario } from "@/app/(app)/investor/scenario-actions";
import { fieldA11y, FormMessage, SubmitButton } from "@/components/form";
import { Card, Field, Input, Select } from "@/components/ui";
import { STRATEGIES, STRATEGY_LABELS, type Assumptions, type Strategy } from "@/lib/finance/assumptions";
import { SECTIONS, getAt, type Unit } from "@/lib/finance/form";

const UNIT_NAME: Record<Unit, string> = {
  aud: "Australian dollars",
  aud_month: "Australian dollars per month",
  aud_year: "Australian dollars per year",
  pct: "percent",
  months: "months",
};

const AFFIX: Record<Unit, { prefix?: string; suffix?: string }> = {
  aud: { prefix: "$" },
  aud_month: { prefix: "$", suffix: "/ month" },
  aud_year: { prefix: "$", suffix: "/ year" },
  pct: { suffix: "%" },
  months: { suffix: "months" },
};

function display(value: unknown, unit: Unit) {
  if (typeof value !== "number") return "";
  if (value === 0) return "0";
  return unit === "pct" || unit === "months" ? String(value) : value.toLocaleString("en-AU", { maximumFractionDigits: 2 });
}

export function ScenarioForm({
  propertyId,
  scenarioId,
  name,
  assumptions,
}: {
  propertyId: string;
  scenarioId: string | null;
  name: string;
  assumptions: Assumptions;
}) {
  const [state, action] = useActionState(saveScenario.bind(null, propertyId, scenarioId), undefined);
  const [strategy, setStrategy] = useState<Strategy>(assumptions.strategy);
  const fe = state?.fieldErrors;

  return (
    <form action={action} className="space-y-6" noValidate>
      <FormMessage state={state} />
      <Card className="space-y-5">
        <Field id="name" label="Scenario name" errors={fe?.name}>
          <Input {...fieldA11y("name", fe?.name)} defaultValue={name} placeholder="e.g. Knock down and build duplex" required />
        </Field>
        <fieldset>
          <legend className="text-sm font-medium text-slate-800">Strategy</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {STRATEGIES.map((s) => (
              <label
                key={s}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50"
              >
                <input type="radio" name="strategy" value={s} checked={strategy === s} onChange={() => setStrategy(s)} />
                {STRATEGY_LABELS[s]}
              </label>
            ))}
          </div>
        </fieldset>
        <Field id="land.basis" label="Land basis" errors={fe?.["land.basis"]}>
          <Select {...fieldA11y("land.basis", fe?.["land.basis"])} defaultValue={assumptions.land.basis}>
            <option value="purchase_price">Buying the site (purchase price)</option>
            <option value="current_value">Already owned (current value as opportunity cost)</option>
          </Select>
        </Field>
        <p className="text-xs text-slate-500">
          Every figure below is your assumption. SitePilot does not supply valuations, construction rates, duty or tax
          figures. Results are pre-tax; GST, CGT and income tax are not modelled.
        </p>
      </Card>

      {SECTIONS.map((section) => {
        const hidden = section.strategies !== undefined && !section.strategies.includes(strategy);
        return (
          // Hidden sections still submit their values, so switching strategy never loses inputs.
          <Card key={section.id} hidden={hidden}>
            <fieldset>
              <legend className="font-semibold">{section.title}</legend>
              {section.description ? <p className="mt-1 text-sm text-slate-600">{section.description}</p> : null}
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {section.fields.map((f) => {
                  const errors = fe?.[f.path];
                  const affix = AFFIX[f.unit];
                  return (
                    <Field
                      key={f.path}
                      id={f.path}
                      label={
                        <>
                          {f.label}
                          <span className="sr-only"> ({UNIT_NAME[f.unit]})</span>
                        </>
                      }
                      hint={f.hint}
                      errors={errors}
                    >
                      <div className="flex items-center rounded-lg border border-slate-300 bg-white shadow-sm focus-within:ring-2 focus-within:ring-brand-500">
                        {affix.prefix ? <span className="pl-3 text-sm text-slate-500" aria-hidden="true">{affix.prefix}</span> : null}
                        <input
                          {...fieldA11y(f.path, errors, Boolean(f.hint))}
                          inputMode="decimal"
                          autoComplete="off"
                          defaultValue={display(getAt(assumptions, f.path), f.unit)}
                          className="block w-full rounded-lg border-0 bg-transparent px-2 py-2 text-right text-sm tabular-nums focus:outline-none focus:ring-0"
                        />
                        {affix.suffix ? <span className="whitespace-nowrap pr-3 text-sm text-slate-500" aria-hidden="true">{affix.suffix}</span> : null}
                      </div>
                    </Field>
                  );
                })}
              </div>
            </fieldset>
          </Card>
        );
      })}

      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Calculating…">Save and calculate</SubmitButton>
        <p className="text-xs text-slate-500">Each save is kept in the scenario&apos;s history with the formula version used.</p>
      </div>
    </form>
  );
}
