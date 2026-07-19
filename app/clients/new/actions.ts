"use server";

import { createClient, type ClientInput } from "@/lib/clients";
import type { ClientErrors } from "./client-form";

// Server action backing the onboarding form. The form calls this with the
// entered values; on a validation failure we return the field-keyed errors so
// the form can surface them without losing the entered data. On success we
// return `{ ok: true }` and the page navigates to the list.
export async function saveClient(
  values: ClientInput,
): Promise<{ ok: true } | { ok: false; errors: ClientErrors }> {
  const result = await createClient(values);
  if (!result.ok) return { ok: false, errors: result.errors };
  return { ok: true };
}