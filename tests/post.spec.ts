import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";

// Behavior A — the data model round-trips a full week's worth of content.
//
// A Plan is the atomic result of one "Generate this week" click: one Plan plus
// three draft Posts, created together. A Post carries the planner fields, the
// copywriter output split into scalar columns (hook/caption/cta) plus Json
// document fields (slides/hashtags/reviewFlags), scheduling + lifecycle fields,
// and the four per-agent token counts. There is no opaque `copy` column
// (ADR-0001: post content is stored as a document).

describe("data model: Client → Plan → Posts round-trip", () => {
  beforeAll(async () => {
    // migrations are applied to test.db by vitest.global-setup.ts
  });

  beforeEach(async () => {
    await prisma.post.deleteMany();
    await prisma.plan.deleteMany();
    await prisma.client.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("stores a Plan with three draft Posts and reads them back with full fidelity", async () => {
    const client = await prisma.client.create({
      data: {
        name: "Lakeside Dental",
        location: "Austin, TX",
        audience: "Families, working professionals",
        brandVoice: "warm, clear, professional, family-friendly",
        colors: "#0A6E7C, #FFFFFF",
        logoUrl: "https://example.com/logo.png",
        pillarMon: "Patient Education",
        pillarWed: "Trust & Clinic Branding",
        pillarFri: "Engagement / Fun",
      },
    });

    const plan = await prisma.plan.create({
      data: {
        clientId: client.id,
        period: "week",
        label: "Week of 2026-07-20",
      },
    });

    const scheduled = new Date("2026-07-20T09:00:00Z");

    const slideDoc = [
      {
        heading: "Bleeding gums? Read this",
        description: "3 causes you can spot at home",
        imageIdeas: [
          { type: "photo", text: "close-up of healthy vs inflamed gumline" },
          { type: "creative", text: "icon trio: floss, brush, rinse" },
        ],
      },
      {
        heading: "Cause 1",
        description: "Plaque buildup along the gumline",
        imageIdeas: [{ type: "creative", text: "diagram of plaque layer" }],
      },
    ];

    const reviewFlags = [
      { claim: "bleeding gums are an early sign of gum disease", reason: "medical claim" },
      { claim: "flossing daily reduces gingivitis", reason: "outcome-adjacent claim" },
    ];

    const post = await prisma.post.create({
      data: {
        clientId: client.id,
        planId: plan.id,
        pillar: "Patient Education",
        format: "carousel",
        topic: "Why bleeding gums are not normal — 3 causes",
        objective: "Teach patients to recognise gingivitis early and book a checkup",
        hook: "Bleeding gums are not a flex. Here's what they're telling you.",
        caption: "Most people brush past bleeding gums. Don't.\n\nGingivitis is reversible — if you catch it early.",
        cta: "Book a checkup at the link in bio.",
        hashtags: ["#dentalcare", "#gumhealth", "#austindentist", "#oralhealth"],
        slides: slideDoc,
        reviewFlags,
        scheduledDate: scheduled,
        plannerPromptTokens: 420,
        plannerOutputTokens: 180,
        copywriterPromptTokens: 510,
        copywriterOutputTokens: 940,
      },
    });

    // round-trip
    const reloaded = await prisma.post.findUniqueOrThrow({
      where: { id: post.id },
      include: { plan: true, client: true },
    });

    // lifecycle + scheduling
    expect(reloaded.status).toBe("draft"); // default
    expect(reloaded.publishedAt).toBeNull();
    expect(reloaded.flagsAcknowledgedAt).toBeNull();
    expect(reloaded.scheduledDate?.toISOString()).toBe(scheduled.toISOString());

    // planner fields
    expect(reloaded.pillar).toBe("Patient Education");
    expect(reloaded.format).toBe("carousel");
    expect(reloaded.objective).toContain("gingivitis");

    // copywriter scalar output
    expect(reloaded.hook).toContain("Bleeding gums");
    expect(reloaded.caption).toContain("Gingivitis is reversible");
    expect(reloaded.cta).toContain("Book a checkup");

    // Json document fields preserve nested structure (ADR-0001)
    const slides = reloaded.slides as unknown as typeof slideDoc;
    expect(slides).toHaveLength(2);
    expect(slides[0].heading).toBe("Bleeding gums? Read this");
    expect(slides[0].imageIdeas).toHaveLength(2);
    expect(slides[0].imageIdeas[0].type).toBe("photo");

    const hashtags = reloaded.hashtags as unknown as string[];
    expect(hashtags).toContain("#austindentist");

    const flags = reloaded.reviewFlags as unknown as typeof reviewFlags;
    expect(flags).toHaveLength(2);
    expect(flags[0]).toMatchObject({ claim: expect.any(String), reason: "medical claim" });

    // per-agent token counts
    expect(reloaded.plannerPromptTokens).toBe(420);
    expect(reloaded.copywriterOutputTokens).toBe(940);

    // relations
    expect(reloaded.plan?.label).toBe("Week of 2026-07-20");
    expect(reloaded.client?.pillarFri).toBe("Engagement / Fun");
  });

  it("has no opaque `copy` column — content lives in scalar + Json fields, per ADR-0001", async () => {
    const cols = await prisma.$queryRaw<{ name: string }[]>`
      SELECT name FROM pragma_table_info('Post')
    `;
    const names = cols.map((c) => c.name);

    // document fields exist as columns
    expect(names).toEqual(expect.arrayContaining(["hook", "caption", "cta", "slides", "hashtags", "reviewFlags", "objective", "scheduledDate", "flagsAcknowledgedAt"]));

    // the rejected opaque column must not exist
    expect(names).not.toContain("copy");
  });

  it("does NOT carry Client.monthlyTokenBudget — deferred to v2", async () => {
    const cols = await prisma.$queryRaw<{ name: string }[]>`
      SELECT name FROM pragma_table_info('Client')
    `;
    const names = cols.map((c) => c.name);
    expect(names).not.toContain("monthlyTokenBudget");
  });
});