import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { createClient, listClients } from "@/lib/clients";

// Issue #3 — Client onboarding form + Client list.
//
// `lib/clients.ts` is the deep module behind the onboarding form: a small
// interface (`createClient`, `listClients`) over Prisma that owns validation,
// persistence, and the brand-voice fidelity guarantee. The UI (ClientForm /
// ClientList) is a thin shell over this module. These tests exercise the
// behavior through the public interface — they describe what onboarding does,
// not how it persists, so they survive any internal refactor.

describe("client onboarding: createClient + listClients", () => {
  beforeEach(async () => {
    await prisma.client.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("persists a valid Client with every field and it appears in listClients", async () => {
    const result = await createClient({
      name: "Lakeside Dental",
      location: "Austin, TX",
      audience: "Families, working professionals",
      brandVoice: "warm, clear, professional, family-friendly",
      colors: "#0A6E7C, #FFFFFF",
      logoUrl: "https://example.com/logo.png",
      pillarMon: "Patient Education",
      pillarWed: "Trust & Clinic Branding",
      pillarFri: "Engagement / Fun",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return; // narrowing
    expect(result.client.id).toBeTruthy();
    expect(result.client.name).toBe("Lakeside Dental");
    expect(result.client.pillarFri).toBe("Engagement / Fun");

    // submitting returns the operator to the list, where the new clinic appears
    const all = await listClients();
    expect(all.map((c) => c.id)).toContain(result.client.id);
    const listed = all.find((c) => c.id === result.client.id);
    expect(listed?.name).toBe("Lakeside Dental");
    expect(listed?.pillarMon).toBe("Patient Education");
    expect(listed?.colors).toBe("#0A6E7C, #FFFFFF");
  });

  it("rejects a missing name or any pillar with field-keyed errors and persists nothing", async () => {
    const before = await prisma.client.count();

    const result = await createClient({
      name: "",
      pillarMon: "",
      pillarWed: "Trust & Clinic Branding",
      pillarFri: "",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.name).toBeTruthy();
    expect(result.errors.pillarMon).toBeTruthy();
    expect(result.errors.pillarFri).toBeTruthy();
    // pillarWed was provided, so it has no error
    expect(result.errors.pillarWed).toBeUndefined();

    // nothing was persisted
    expect(await prisma.client.count()).toBe(before);
  });

  it("stores blank optional fields as null and persists the client", async () => {
    const result = await createClient({
      name: "Smile Studio",
      // location, audience, brandVoice, colors, logoUrl all omitted (blank)
      pillarMon: "Patient Education",
      pillarWed: "Trust & Clinic Branding",
      pillarFri: "Engagement / Fun",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const reloaded = await prisma.client.findUniqueOrThrow({
      where: { id: result.client.id },
    });
    expect(reloaded.name).toBe("Smile Studio");
    expect(reloaded.location).toBeNull();
    expect(reloaded.audience).toBeNull();
    expect(reloaded.brandVoice).toBeNull();
    expect(reloaded.colors).toBeNull();
    expect(reloaded.logoUrl).toBeNull();
  });

  it("round-trips brandVoice verbatim — whitespace and newlines survive unmodified", async () => {
    // brandVoice is injected into the copywriter prompt later, so it must
    // survive the round trip exactly as entered — no trimming, no
    // collapsing, no reformatting. Leading/trailing/internal whitespace and
    // newlines all carry meaning for prompt formatting.
    const voice =
      "  warm, clear,\n\nprofessional,\t  family-friendly  \n  ";

    const result = await createClient({
      name: "Riverside Dental",
      brandVoice: voice,
      pillarMon: "Patient Education",
      pillarWed: "Trust & Clinic Branding",
      pillarFri: "Engagement / Fun",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const reloaded = await prisma.client.findUniqueOrThrow({
      where: { id: result.client.id },
    });
    expect(reloaded.brandVoice).toBe(voice);
  });
});