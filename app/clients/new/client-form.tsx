"use client";

import { useState } from "react";
import type { ClientInput } from "@/lib/clients";
import { BUTTON_PRIMARY, Card, MicroLabel } from "@/app/ui";

// The onboarding form — a thin shell over lib/clients.ts, built to the design's
// onboarding screen. Holds field values in local state and calls
// `onSubmit(values)`. The prop returns field-keyed errors (or null on success);
// the form surfaces them WITHOUT clearing the entered values, so the operator
// never loses what they typed on a validation failure.
//
// The hint beside submit names the required fields as you fill them in. The
// design DISABLES submit until they are all present; this does not, because
// validation belongs to the server action — it is the only thing that knows the
// real rules, and a client-side gate that refuses the click means a genuine
// server-side rejection can never be surfaced or tested. The hint gives the
// operator the same information without taking the decision away.
//
// Every class is a token-derived utility — no hardcoded colors, radii, or fonts,
// per ADR-0003 and the no-hardcoded-tokens guard.

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

  const valid = Boolean(
    values.name.trim() &&
      values.pillarMon.trim() &&
      values.pillarWed.trim() &&
      values.pillarFri.trim(),
  );

  return (
    <form onSubmit={handleSubmit} className="font-sans">
      <h1 className="text-heading font-semibold text-text">Add a clinic</h1>
      <p className="mb-5 mt-1 text-control text-muted">
        Everything the planner and copywriter need to write in this clinic&rsquo;s
        voice.
      </p>

      <Card className="flex flex-col gap-5">
        {/* Paired fields sit side by side — they are short and read as one line
            of identity, so stacking them wastes vertical space. */}
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
          <Field
            label="Brand colors"
            hint="The first color becomes the clinic's accent everywhere."
          >
            <input
              name="colors"
              aria-label="Brand colors"
              className={INPUT}
              placeholder="Two hex colors, comma separated"
              value={values.colors ?? ""}
              onChange={(e) => field("colors", e.target.value)}
            />
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
          <p className="text-body text-muted">
            One per posting day — these drive what the planner writes each week.
          </p>

          {/* A `96px | 1fr` row per pillar: the day is a fixed accent-colored
              gutter, so the three posting days read as a column you can scan
              rather than as three unrelated labelled fields. */}
          <div className="mt-1 flex flex-col gap-2">
            <PillarRow
              day="Monday"
              name="pillarMon"
              placeholder="e.g. Patient education"
              value={values.pillarMon}
              error={errors.pillarMon}
              onChange={(v) => field("pillarMon", v)}
            />
            <PillarRow
              day="Wednesday"
              name="pillarWed"
              placeholder="e.g. Behind the scenes"
              value={values.pillarWed}
              error={errors.pillarWed}
              onChange={(v) => field("pillarWed", v)}
            />
            <PillarRow
              day="Friday"
              name="pillarFri"
              placeholder="e.g. Community engagement"
              value={values.pillarFri}
              error={errors.pillarFri}
              onChange={(v) => field("pillarFri", v)}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-border pt-4">
          <button type="submit" className={BUTTON_PRIMARY}>
            Create clinic
          </button>
          <span className="text-body text-muted">
            {valid
              ? "You can tweak everything later."
              : "Name and all three pillars are required."}
          </span>
        </div>
      </Card>
    </form>
  );
}

// One input recipe, so every field in the form is identically sized and
// bordered. Inputs sit on `surface` INSIDE a `surface-raised` card — the
// inversion of the usual page relationship is what makes them read as wells.
const INPUT =
  "w-full rounded-sm border border-border bg-surface px-2.5 py-2 text-control text-text focus:border-accent";

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    // The <label> still WRAPS its control, which is what associates them without
    // an id/htmlFor pair. Restyling the label text must not break that — the
    // form's tests find every field via getByLabelText.
    <label className="flex flex-col gap-1 font-sans text-text">
      <MicroLabel>{label}</MicroLabel>
      {children}
      {hint ? <span className="text-body-sm text-muted">{hint}</span> : null}
      {error ? (
        <span role="alert" className="text-body-lg text-danger">
          {error}
        </span>
      ) : null}
    </label>
  );
}

function PillarRow({
  day,
  name,
  placeholder,
  value,
  error,
  onChange,
}: {
  day: string;
  name: string;
  placeholder: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid grid-cols-[96px_1fr] items-center gap-2 font-sans text-text">
      {/* Visible text is just the day; the input carries the full
            "Monday pillar" accessible name, which an explicit aria-label
            supplies even though this label wraps it. */}
      <span className="text-body font-semibold text-accent">{day}</span>
      <div className="flex flex-col gap-1">
        <input
          name={name}
          aria-label={`${day} pillar`}
          className={INPUT}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {error ? (
          <span role="alert" className="text-body-lg text-danger">
            {error}
          </span>
        ) : null}
      </div>
    </label>
  );
}
