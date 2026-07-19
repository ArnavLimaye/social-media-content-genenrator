"use client";

import { useState } from "react";
import type { ClientInput } from "@/lib/clients";
import { Card, MicroLabel } from "@/app/ui";

// The onboarding form — a thin shell over lib/clients.ts. Holds field values
// in local state and calls `onSubmit(values)`. The prop returns field-keyed
// errors (or null on success); the form surfaces them WITHOUT clearing the
// entered values, so the operator never loses what they typed on a validation
// failure. The page wires `onSubmit` to the real server action.
//
// Every class is a token-derived utility (bg-surface, text-text, border-border,
// rounded, font-sans, spacing) — no hardcoded colors, radii, or fonts, per
// ADR-0003 and the no-hardcoded-tokens guard.

export type ClientErrors = Partial<Record<keyof ClientInput, string>>;

const EMPTY: ClientInput = {
  name: "",
  location: "",
  audience: "",
  brandVoice: "",
  colors: "",
  logoUrl: "",
  pillarMon: "",
  pillarWed: "",
  pillarFri: "",
};

export function ClientForm({
  onSubmit,
}: {
  onSubmit: (values: ClientInput) => Promise<ClientErrors | null>;
}) {
  const [values, setValues] = useState<ClientInput>(EMPTY);
  const [errors, setErrors] = useState<ClientErrors>({});

  function field<K extends keyof ClientInput>(key: K, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const errs = await onSubmit(values);
    // On success the page navigates away; if errors come back, surface them
    // without touching `values` so the entered data is preserved.
    if (errs) setErrors(errs);
  }

  return (
    <form onSubmit={handleSubmit} className="font-sans">
      <Card className="flex flex-col gap-5">
        {/* Paired fields sit side by side — they are short and read as one
            line of identity, so stacking them wastes vertical space. */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Clinic name" error={errors.name}>
            <input
              name="name"
              aria-label="Clinic name"
              className={INPUT}
              placeholder="e.g. Riverbend Dental"
              value={values.name}
              onChange={(e) => field("name", e.target.value)}
            />
          </Field>

          <Field label="Location">
            <input
              name="location"
              aria-label="Location"
              className={INPUT}
              placeholder="City, state"
              value={values.location ?? ""}
              onChange={(e) => field("location", e.target.value)}
            />
          </Field>
        </div>

        <Field label="Audience">
          <input
            name="audience"
            aria-label="Audience"
            className={INPUT}
            placeholder="e.g. Parents of kids 2–12, anxious first-timers"
            value={values.audience ?? ""}
            onChange={(e) => field("audience", e.target.value)}
          />
        </Field>

        <Field label="Brand voice">
          <textarea
            name="brandVoice"
            aria-label="Brand voice"
            className={`${INPUT} resize-y leading-relaxed`}
            rows={3}
            placeholder="e.g. Warm and plainspoken. Evidence-first, never salesy. No scare tactics."
            value={values.brandVoice ?? ""}
            onChange={(e) => field("brandVoice", e.target.value)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Brand colors">
            <input
              name="colors"
              aria-label="Brand colors"
              className={INPUT}
              placeholder="Two hex colors, comma separated"
              value={values.colors ?? ""}
              onChange={(e) => field("colors", e.target.value)}
            />
            <span className="text-sm text-muted">
              The first color becomes the clinic&apos;s accent everywhere.
            </span>
          </Field>

          <Field label="Logo URL">
            <input
              name="logoUrl"
              aria-label="Logo URL"
              className={INPUT}
              placeholder="https://…"
              value={values.logoUrl ?? ""}
              onChange={(e) => field("logoUrl", e.target.value)}
            />
          </Field>
        </div>

        <div className="flex flex-col gap-2 border-t border-border pt-5">
          <MicroLabel>Content pillars</MicroLabel>
          <span className="text-sm text-muted">
            One per posting day — these drive what the planner writes each week.
          </span>

          <Field label="Monday pillar" error={errors.pillarMon}>
            <input
              name="pillarMon"
              aria-label="Monday pillar"
              className={INPUT}
              placeholder="e.g. Patient education"
              value={values.pillarMon}
              onChange={(e) => field("pillarMon", e.target.value)}
            />
          </Field>

          <Field label="Wednesday pillar" error={errors.pillarWed}>
            <input
              name="pillarWed"
              aria-label="Wednesday pillar"
              className={INPUT}
              placeholder="e.g. Behind the scenes"
              value={values.pillarWed}
              onChange={(e) => field("pillarWed", e.target.value)}
            />
          </Field>

          <Field label="Friday pillar" error={errors.pillarFri}>
            <input
              name="pillarFri"
              aria-label="Friday pillar"
              className={INPUT}
              placeholder="e.g. Community engagement"
              value={values.pillarFri}
              onChange={(e) => field("pillarFri", e.target.value)}
            />
          </Field>
        </div>

        {/* self-start, or the button stretches the full width of the form —
            which is what it did before #14. */}
        <button
          type="submit"
          className="self-start rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-on-primary"
        >
          Save client
        </button>
      </Card>
    </form>
  );
}

// One input recipe, so every field in the form is identically sized and
// bordered. Inputs sit on `surface` INSIDE a `surface-raised` card — the
// inversion of the usual page relationship is what makes them read as wells.
const INPUT =
  "w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text";

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    // The <label> still WRAPS its control, which is what associates them
    // without an id/htmlFor pair. Restyling the label text must not break that
    // — the form's tests find every field via getByLabelText.
    <label className="flex flex-col gap-1 font-sans text-text">
      <MicroLabel>{label}</MicroLabel>
      {children}
      {error ? (
        <span role="alert" className="text-sm text-danger">
          {error}
        </span>
      ) : null}
    </label>
  );
}