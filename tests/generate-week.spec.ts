import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { generateWeek } from "@/lib/generate-week";
import { DOMAIN_PROFILE } from "@/lib/prompts/domain";
import { fakeCaller } from "./support/fake-caller";

// Issue #5 — the generate-week orchestrator: Planner → 3 draft Posts, written
// with a Plan in a single transaction. Ollama is injected (via agent-json's
// `caller`) so every test uses a fake caller + the real test.db — no network.
//
// These tests exercise behavior through the public `generateWeek` interface:
// what the orchestrator produces, not how it calls the model or writes rows.
// They survive any internal refactor.

const PLANNER_OUTPUT = {
  posts: [
    {
      day: "Monday",
      pillar: "Patient Education",
      format: "carousel",
      topic: "Why bleeding gums are not normal — 3 causes",
      objective: "Teach patients to recognise gingivitis early and book a checkup",
    },
    {
      day: "Wednesday",
      pillar: "Trust & Clinic Branding",
      format: "infographic",
      topic: "Meet the team — 20 years caring for Austin",
      objective: "Build trust through the clinic's story",
    },
    {
      day: "Friday",
      pillar: "Engagement / Fun",
      format: "reel",
      topic: "Flossing challenge — can you do it blindfolded?",
      objective: "Drive comments and saves",
    },
  ],
};

const COPYWRITER_OUTPUT = {
  hook: "Bleeding gums are not a flex. Here's what they're telling you.",
  slides: [
    {
      heading: "Bleeding gums? Read this",
      description: "3 causes you can spot at home",
      imageIdeas: [
        { type: "photo", idea: "close-up of healthy vs inflamed gumline" },
        { type: "creative", idea: "icon trio: floss, brush, rinse" },
      ],
    },
  ],
  caption: "Most people brush past bleeding gums. Don't.\n\nGingivitis is reversible — if you catch it early.",
  cta: "Book a checkup at the link in bio.",
  hashtags: ["#dentalcare", "#gumhealth", "#austindentist"],
  reviewFlags: [
    { claim: "bleeding gums are an early sign of gum disease", reason: "medical claim" },
  ],
};

const WEEK_START = new Date("2026-07-20T09:00:00Z"); // a Monday

async function seedClient() {
  await prisma.client.deleteMany();
  return prisma.client.create({
    data: {
      name: "Lakeside Dental",
      location: "Austin, TX",
      audience: "Families, working professionals",
      brandVoice: "warm, clear, professional, family-friendly",
      pillarMon: "Patient Education",
      pillarWed: "Trust & Clinic Branding",
      pillarFri: "Engagement / Fun",
    },
  });
}

// Happy-path scripted responses: planner once, then one full copy per post.
function happyPathResponses() {
  const planner = {
    text: JSON.stringify(PLANNER_OUTPUT),
    promptTokens: 420,
    outputTokens: 180,
  };
  const copy = (pt: number, ot: number) => ({
    text: JSON.stringify(COPYWRITER_OUTPUT),
    promptTokens: pt,
    outputTokens: ot,
  });
  return [planner, copy(510, 940), copy(520, 950), copy(530, 960)];
}

describe("generateWeek: Planner + Copywriter → Plan + 3 draft Posts", () => {
  beforeEach(async () => {
    await prisma.post.deleteMany();
    await prisma.plan.deleteMany();
    await prisma.client.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates one Plan (period: week) and exactly three draft Posts with the right pillars and Mon/Wed/Fri scheduledDates", async () => {
    const client = await seedClient();
    const { caller } = fakeCaller(happyPathResponses());

    const result = await generateWeek({
      clientId: client.id,
      weekStart: WEEK_START,
      caller,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toEqual([]);

    const plans = await prisma.plan.findMany({ include: { posts: true } });
    expect(plans).toHaveLength(1);
    expect(plans[0].period).toBe("week");
    expect(plans[0].label).toBe("Week of 2026-07-20");
    expect(plans[0].posts).toHaveLength(3);

    const posts = await prisma.post.findMany({ orderBy: { scheduledDate: "asc" } });
    expect(posts).toHaveLength(3);
    expect(posts.every((p) => p.status === "draft")).toBe(true);

    const byPillar = Object.fromEntries(posts.map((p) => [p.pillar, p]));
    expect(byPillar["Patient Education"].scheduledDate?.toISOString()).toBe("2026-07-20T09:00:00.000Z");
    expect(byPillar["Trust & Clinic Branding"].scheduledDate?.toISOString()).toBe("2026-07-22T09:00:00.000Z");
    expect(byPillar["Engagement / Fun"].scheduledDate?.toISOString()).toBe("2026-07-24T09:00:00.000Z");

    // all three posts are attached to the one plan
    expect(new Set(posts.map((p) => p.planId))).toEqual(new Set([plans[0].id]));
  });

  it("passes the last 21 post topics to the planner as an avoid-list (not 22)", async () => {
    const client = await seedClient();

    // Seed 22 prior posts with distinct, ordered topics. createdAt is set
    // explicitly so the "last 21 by createdAt" ordering is deterministic.
    for (let i = 0; i < 22; i++) {
      await prisma.post.create({
        data: {
          clientId: client.id,
          pillar: "Patient Education",
          format: "carousel",
          topic: `old-topic-${i}`,
          objective: "x",
          createdAt: new Date(2026, 0, i + 1), // Jan 1..22, 2026
        },
      });
    }
    // old-topic-21 is the most recent (Jan 22); old-topic-0 the oldest (Jan 1).

    const { caller, calls } = fakeCaller(happyPathResponses());
    await generateWeek({ clientId: client.id, weekStart: WEEK_START, caller });

    const plannerCall = calls[0];
    expect(plannerCall.user).toContain("old-topic-21"); // most recent — included
    expect(plannerCall.user).toContain("old-topic-1"); // 21st-most-recent — included
    expect(plannerCall.user).not.toContain("old-topic-0"); // 22nd (oldest) — excluded
  });

  it("persists per-agent token counts on every Post — planner tokens shared, copywriter tokens per-post", async () => {
    const client = await seedClient();
    const { caller } = fakeCaller(happyPathResponses());

    const result = await generateWeek({ clientId: client.id, weekStart: WEEK_START, caller });
    expect(result.ok).toBe(true);

    const posts = await prisma.post.findMany({ orderBy: { scheduledDate: "asc" } });
    expect(posts).toHaveLength(3);

    // planner ran once (420 prompt / 180 output) — same counts on every post
    for (const p of posts) {
      expect(p.plannerPromptTokens).toBe(420);
      expect(p.plannerOutputTokens).toBe(180);
    }

    // each copywriter call had distinct token usage — per-post
    const copyPt = posts.map((p) => p.copywriterPromptTokens);
    const copyOt = posts.map((p) => p.copywriterOutputTokens);
    expect(copyPt).toEqual([510, 520, 530]);
    expect(copyOt).toEqual([940, 950, 960]);
  });

  it("persists copy in the document shape — slides as objects, reviewFlags as {claim, reason}, hashtags as strings", async () => {
    const client = await seedClient();
    const { caller } = fakeCaller(happyPathResponses());

    await generateWeek({ clientId: client.id, weekStart: WEEK_START, caller });

    const posts = await prisma.post.findMany({ orderBy: { scheduledDate: "asc" } });
    for (const p of posts) {
      expect(p.hook).toBe(COPYWRITER_OUTPUT.hook);
      expect(p.caption).toBe(COPYWRITER_OUTPUT.caption);
      expect(p.cta).toBe(COPYWRITER_OUTPUT.cta);

      const slides = p.slides as unknown as CopywriterOutput["slides"];
      expect(slides).toHaveLength(1);
      expect(slides[0]).toMatchObject({ heading: expect.any(String), description: expect.any(String) });
      expect(slides[0].imageIdeas).toHaveLength(2);
      expect(slides[0].imageIdeas[0]).toMatchObject({ type: "photo", idea: expect.any(String) });

      const hashtags = p.hashtags as unknown as string[];
      expect(hashtags).toContain("#austindentist");

      const flags = p.reviewFlags as unknown as CopywriterOutput["reviewFlags"];
      expect(flags).toHaveLength(1);
      expect(flags[0]).toMatchObject({ claim: expect.any(String), reason: "medical claim" });
    }
  });

  it("keeps the batch alive when one copywriter fails — two complete Posts + one topic-only Post + a warning", async () => {
    const client = await seedClient();

    // Planner ok; Wednesday's copywriter returns unparseable text twice (so the
    // repair retry fails too); Monday and Friday copy succeed.
    const garbage = { text: "no JSON here at all", promptTokens: 50, outputTokens: 5 };
    const responses = [
      { text: JSON.stringify(PLANNER_OUTPUT), promptTokens: 420, outputTokens: 180 },
      { text: JSON.stringify(COPYWRITER_OUTPUT), promptTokens: 510, outputTokens: 940 }, // Monday
      garbage, // Wednesday attempt 1
      garbage, // Wednesday repair retry
      { text: JSON.stringify(COPYWRITER_OUTPUT), promptTokens: 530, outputTokens: 960 }, // Friday
    ];
    const { caller } = fakeCaller(responses);

    const result = await generateWeek({ clientId: client.id, weekStart: WEEK_START, caller });

    // the batch still succeeds
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const posts = await prisma.post.findMany({ orderBy: { scheduledDate: "asc" } });
    expect(posts).toHaveLength(3);

    const byPillar = Object.fromEntries(posts.map((p) => [p.pillar, p]));
    const complete = [byPillar["Patient Education"], byPillar["Engagement / Fun"]];
    for (const p of complete) {
      expect(p.hook).not.toBeNull();
      expect(p.slides).not.toBeNull();
      expect(p.reviewFlags).not.toBeNull();
    }

    // the topic-only Post: planner fields + scheduledDate + token counts present, copy empty
    const wed = byPillar["Trust & Clinic Branding"];
    expect(wed.topic).toBe("Meet the team — 20 years caring for Austin");
    expect(wed.scheduledDate?.toISOString()).toBe("2026-07-22T09:00:00.000Z");
    expect(wed.hook).toBeNull();
    expect(wed.caption).toBeNull();
    expect(wed.cta).toBeNull();
    expect(wed.slides).toBeNull();
    expect(wed.hashtags).toBeNull();
    expect(wed.reviewFlags).toBeNull();
    // planner tokens still present; copywriter tokens logged even on failure
    expect(wed.plannerPromptTokens).toBe(420);
    expect(wed.plannerOutputTokens).toBe(180);
    expect(wed.copywriterPromptTokens).toBe(100); // 50 + 50 across the two attempts
    expect(wed.copywriterOutputTokens).toBe(10);

    // the warning names the failed topic
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("Meet the team");
  });

  it("aborts cleanly on planner failure — no Plan or Posts written", async () => {
    const client = await seedClient();
    const garbage = { text: "no JSON here at all", promptTokens: 50, outputTokens: 5 };
    const { caller } = fakeCaller([garbage, garbage]); // planner fails both attempts

    const beforePlans = await prisma.plan.count();
    const beforePosts = await prisma.post.count();

    const result = await generateWeek({ clientId: client.id, weekStart: WEEK_START, caller });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("planner");

    expect(await prisma.plan.count()).toBe(beforePlans);
    expect(await prisma.post.count()).toBe(beforePosts);
  });

  it("aborts cleanly when the planner returns an invalid shape (two posts)", async () => {
    const client = await seedClient();
    const twoPosts = { posts: PLANNER_OUTPUT.posts.slice(0, 2) };
    const { caller } = fakeCaller([
      { text: JSON.stringify(twoPosts), promptTokens: 400, outputTokens: 150 },
    ]);

    const beforePlans = await prisma.plan.count();
    const result = await generateWeek({ clientId: client.id, weekStart: WEEK_START, caller });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(await prisma.plan.count()).toBe(beforePlans);
    expect(await prisma.post.count()).toBe(0);
  });

  it("injects the domainProfile (dental framing + medical guardrail) into both agents' system prompts", async () => {
    const client = await seedClient();
    const { caller, calls } = fakeCaller(happyPathResponses());

    await generateWeek({ clientId: client.id, weekStart: WEEK_START, caller });

    const plannerCall = calls[0];
    const copywriterCall = calls[1];
    // the medical guardrail sentence from DOMAIN_PROFILE is present in both
    expect(plannerCall.system).toContain("Medical guardrail");
    expect(plannerCall.system).toContain("never promise guaranteed outcomes");
    expect(copywriterCall.system).toContain("Medical guardrail");
    expect(copywriterCall.system).toContain("never promise guaranteed outcomes");
  });

  it("returns ok:false for an unknown client and writes nothing", async () => {
    const beforePlans = await prisma.plan.count();
    const { caller } = fakeCaller(happyPathResponses());

    const result = await generateWeek({
      clientId: "does-not-exist",
      weekStart: WEEK_START,
      caller,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("client");
    expect(await prisma.plan.count()).toBe(beforePlans);
  });

  it("does not model a monthly budget — there is no budget option and no budget in the result (v2)", async () => {
    const client = await seedClient();
    const { caller } = fakeCaller(happyPathResponses());

    const result = await generateWeek({ clientId: client.id, weekStart: WEEK_START, caller });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // no budget surfaced anywhere in the result
    expect(result).not.toHaveProperty("budget");
    expect(result).not.toHaveProperty("budgetExceeded");
    expect(result.warnings).toEqual([]);
  });
});