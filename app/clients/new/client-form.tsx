"use client";

import { useState } from "react";
import type { ClientInput } from "@/lib/clients";

// The onboarding form — a thin shell over lib/clients.ts. Holds field values
// in local state and calls `onSubmit(values)`. The prop returns field-keyed
// errors (or null on success); the form surfaces them WITHOUT clearing the
// entered values, so the operator never loses what they typed on a validation
// failure. The page wires `onSubmit` to the real server action.
//
// Every class is a token-derived utility (bg-surface, text-text, border-muted,
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 font-sans">
      <Field label="Clinic name" error={errors.name}>
        <input
          name="name"
          aria-label="Clinic name"
          className="rounded border border-muted bg-surface px-2 py-1 text-text"
          value={values.name}
          onChange={(e) => field("name", e.target.value)}
        />
      </Field>

      <Field label="Location">
        <input
          name="location"
          aria-label="Location"
          className="rounded border border-muted bg-surface px-2 py-1 text-text"
          value={values.location ?? ""}
          onChange={(e) => field("location", e.target.value)}
        />
      </Field>

      <Field label="Audience">
        <input
          name="audience"
          aria-label="Audience"
          className="rounded border border-muted bg-surface px-2 py-1 text-text"
          value={values.audience ?? ""}
          onChange={(e) => field("audience", e.target.value)}
        />
      </Field>

      <Field label="Brand voice">
        <textarea
          name="brandVoice"
          aria-label="Brand voice"
          className="rounded border border-muted bg-surface px-2 py-1 text-text"
          rows={4}
          value={values.brandVoice ?? ""}
          onChange={(e) => field("brandVoice", e.target.value)}
        />
      </Field>

      <Field label="Brand colors">
        <input
          name="colors"
          aria-label="Brand colors"
          className="rounded border border-muted bg-surface px-2 py-1 text-text"
          value={values.colors ?? ""}
          onChange={(e) => field("colors", e.target.value)}
        />
      </Field>

      <Field label="Logo URL">
        <input
          name="logoUrl"
          aria-label="Logo URL"
          className="rounded border border-muted bg-surface px-2 py-1 text-text"
          value={values.logoUrl ?? ""}
          onChange={(e) => field("logoUrl", e.target.value)}
        />
      </Field>

      <Field label="Monday pillar" error={errors.pillarMon}>
        <input
          name="pillarMon"
          aria-label="Monday pillar"
          className="rounded border border-muted bg-surface px-2 py-1 text-text"
          value={values.pillarMon}
          onChange={(e) => field("pillarMon", e.target.value)}
        />
      </Field>

      <Field label="Wednesday pillar" error={errors.pillarWed}>
        <input
          name="pillarWed"
          aria-label="Wednesday pillar"
          className="rounded border border-muted bg-surface px-2 py-1 text-text"
          value={values.pillarWed}
          onChange={(e) => field("pillarWed", e.target.value)}
        />
      </Field>

      <Field label="Friday pillar" error={errors.pillarFri}>
        <input
          name="pillarFri"
          aria-label="Friday pillar"
          className="rounded border border-muted bg-surface px-2 py-1 text-text"
          value={values.pillarFri}
          onChange={(e) => field("pillarFri", e.target.value)}
        />
      </Field>

      <button
        type="submit"
        className="rounded bg-primary px-4 py-2 text-surface"
      >
        Save client
      </button>
    </form>
  );
}

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
    <label className="flex flex-col gap-1 font-sans text-text">
      <span>{label}</span>
      {children}
      {error ? (
        <span role="alert" className="text-muted">
          {error}
        </span>
      ) : null}
    </label>
  );
}