import { prisma } from "@/lib/db";
import type { Client } from "@/generated/prisma/client";

// Deep module behind the Client onboarding form + list (issue #3).
//
// A small interface — `createClient` (validate + persist) and `listClients`
// (read all) — over Prisma. The form/page layer is a thin shell over this.
// Validation, optional-null handling, and the brand-voice fidelity guarantee
// all live here so they are exercised through the public interface.

export interface ClientInput {
  name: string;
  location?: string | null;
  audience?: string | null;
  brandVoice?: string | null;
  colors?: string | null;
  logoUrl?: string | null;
  pillarMon: string;
  pillarWed: string;
  pillarFri: string;
}

export type CreateClientResult =
  | { ok: true; client: Client }
  | { ok: false; errors: Partial<Record<keyof ClientInput, string>> };

export async function createClient(
  input: ClientInput,
): Promise<CreateClientResult> {
  // Required fields: the clinic name and the three Mon/Wed/Fri pillars
  // (ADR-0002 — the three-pillar shape is a hardcoded constant).
  const required: Array<keyof ClientInput> = [
    "name",
    "pillarMon",
    "pillarWed",
    "pillarFri",
  ];
  const errors: Partial<Record<keyof ClientInput, string>> = {};
  for (const field of required) {
    const value = input[field];
    if (typeof value !== "string" || value.trim() === "") {
      errors[field] = "Required";
    }
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const client = await prisma.client.create({
    data: {
      name: input.name,
      location: input.location ?? null,
      audience: input.audience ?? null,
      brandVoice: input.brandVoice ?? null,
      colors: input.colors ?? null,
      logoUrl: input.logoUrl ?? null,
      pillarMon: input.pillarMon,
      pillarWed: input.pillarWed,
      pillarFri: input.pillarFri,
    },
  });
  return { ok: true, client };
}

export async function listClients(): Promise<Client[]> {
  return prisma.client.findMany({ orderBy: { createdAt: "desc" } });
}

// The required-for-generation fields (issue #6). A Client missing any of
// these cannot be generated for — the dashboard blocks the "Generate this
// week" button with this reason instead of triggering a broken run. Same
// required set as `createClient` (name + the three Mon/Wed/Fri pillars,
// ADR-0002). Pure: no DB, no I/O — takes just the fields it needs.
export type GenerationRequired = Pick<Client, "name" | "pillarMon" | "pillarWed" | "pillarFri">;

const PILLAR_LABELS: Array<{ field: keyof GenerationRequired; label: string }> = [
  { field: "pillarMon", label: "Monday" },
  { field: "pillarWed", label: "Wednesday" },
  { field: "pillarFri", label: "Friday" },
];

export function generationBlocker(client: GenerationRequired): string | null {
  if (!client.name || client.name.trim() === "") {
    return "Clinic name is missing — add it before generating.";
  }
  for (const { field, label } of PILLAR_LABELS) {
    const value = client[field];
    if (typeof value !== "string" || value.trim() === "") {
      return `${label} pillar is missing — add it before generating.`;
    }
  }
  return null;
}