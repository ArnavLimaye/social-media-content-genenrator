import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { generateWeek, regenerateWeek, weekPlanSummary } from "@/lib/generate-week";
import { fakeCaller, type Scripted } from "./support/fake-caller";

// Issue #11 — the duplicate-week block and week-level Regenerate.
//
// Two behaviors that only make sense together: a Client may hold only one Plan
// per week, and the way to redo that week is an explicit Regenerate that
// discards its *draft* Posts and nothing else. The destructive scope is the
// point of these tests — approved and published Posts are committed or already
// public, so regeneration must never reach them.
//
// Ollama is injected (agent-json's `caller`) so every test drives a fake
// against the real test.db — no network.

const PLANNER_OUTPUT = {
  posts: [
    {
      day: "Monday",
      pillar: "Patient Education",
      format: "carousel",
      topic: "Why bleeding gums are not normal — 3 causes",
      objective: "Teach patients to recognise gingivitis early",
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
  hook: "Bleeding gums are not a flex.",
  slides: [
    {
      heading: "Bleeding gums? Read this",
      description: "3 causes you can spot at home",
      imageIdeas: [{ type: "photo", idea: "healthy vs inflamed gumline" }],
    },
  ],
  caption: "Gingivitis is reversible — if you catch it early.",
  cta: "Book a checkup at the link in bio.",
  hashtags: ["#dentalcare", "#gumhealth"],
  reviewFlags: [],
};

// A second, distinct plan — lets a regeneration test tell fresh Posts from the
// ones it replaced by topic alone.
const REGEN_PLANNER_OUTPUT = {
  posts: [
    {
      day: "Monday",
      pillar: "Patient Education",
      format: "reel",
      topic: "REGEN Monday — three signs you grind your teeth at night",
      objective: "Surface bruxism symptoms patients dismiss",
    },
    {
      day: "Wednesday",
      pillar: "Trust & Clinic Branding",
      format: "carousel",
      topic: "REGEN Wednesday — a day in our hygienist's chair",
      objective: "Humanise the practice",
    },
    {
      day: "Friday",
      pillar: "Engagement / Fun",
      format: "reel",
      topic: "REGEN Friday — guess the toothbrush era",
      objective: "Drive comments",
    },
  ],
};

// Only the days named, in the order given — for regenerating a partial week.
function plannerFor(days: string[]) {
  return {
    posts: REGEN_PLANNER_OUTPUT.posts.filter((p) => days.includes(p.day)),
  };
}

const WEEK_START = new Date("2026-07-20T09:00:00Z"); // a Monday

// Planner once, then one copywriter call per planned post.
function responsesFor(postCount: number, planner = PLANNER_OUTPUT): Scripted[] {
  const out: Scripted[] = [
    { text: JSON.stringify(planner), promptTokens: 420, outputTokens: 180 },
  ];
  for (let i = 0; i < postCount; i++) {
    out.push({ text: JSON.stringify(COPYWRITER_OUTPUT), promptTokens: 500, outputTokens: 900 });
  }
  return out;
}

async function seedClient() {
  return prisma.client.create({
    data: {
      name: "Lakeside Dental",
      location: "Austin, TX",
      audience: "Families, working professionals",
      brandVoice: "warm, clear, professional",
      pillarMon: "Patient Education",
      pillarWed: "Trust & Clinic Branding",
      pillarFri: "Engagement / Fun",
    },
  });
}

describe("duplicate-week block", () => {
  beforeEach(async () => {
    await prisma.post.deleteMany();
    await prisma.plan.deleteMany();
    await prisma.client.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("refuses a second generation for a week that already has a Plan, pointing the operator at Regenerate", async () => {
    const client = await seedClient();

    const first = await generateWeek({
      clientId: client.id,
      weekStart: WEEK_START,
      caller: fakeCaller(responsesFor(3)).caller,
    });
    expect(first.ok).toBe(true);

    // A second "Generate this week" for the same week must not produce a
    // second "Week of ..." Plan — it must send the operator to Regenerate.
    const second = await generateWeek({
      clientId: client.id,
      weekStart: WEEK_START,
      caller: fakeCaller(responsesFor(3)).caller,
    });

    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error).toMatch(/regenerate/i);

    // Nothing added: still one Plan and its three Posts.
    expect(await prisma.plan.count()).toBe(1);
    expect(await prisma.post.count()).toBe(3);
  });

  it("blocks on the week, not the moment — a different time of day on the same Monday is still that week", async () => {
    const client = await seedClient();

    await generateWeek({
      clientId: client.id,
      weekStart: new Date("2026-07-20T09:00:00Z"),
      caller: fakeCaller(responsesFor(3)).caller,
    });

    // Same Monday, later in the day. The operator thinks of this as "this
    // week"; so must the block.
    const second = await generateWeek({
      clientId: client.id,
      weekStart: new Date("2026-07-20T17:45:00Z"),
      caller: fakeCaller(responsesFor(3)).caller,
    });

    expect(second.ok).toBe(false);
    expect(await prisma.plan.count()).toBe(1);
  });

  it("blocks per week, not per client — the next week still generates", async () => {
    const client = await seedClient();

    await generateWeek({
      clientId: client.id,
      weekStart: WEEK_START,
      caller: fakeCaller(responsesFor(3)).caller,
    });

    const nextWeek = await generateWeek({
      clientId: client.id,
      weekStart: new Date("2026-07-27T09:00:00Z"),
      caller: fakeCaller(responsesFor(3)).caller,
    });

    expect(nextWeek.ok).toBe(true);
    expect(await prisma.plan.count()).toBe(2);
    expect(await prisma.post.count()).toBe(6);
  });

  it("refuses a duplicate week at the database level, not only in the orchestrator", async () => {
    const client = await seedClient();
    const weekStart = new Date("2026-07-20T00:00:00Z");
    await prisma.plan.create({
      data: { clientId: client.id, period: "week", weekStart, label: "Week of 2026-07-20" },
    });

    // Two "Week of ..." columns for the same dates is a data-model error, so a
    // caller reaching past the orchestrator is refused too.
    await expect(
      prisma.plan.create({
        data: { clientId: client.id, period: "week", weekStart, label: "Week of 2026-07-20" },
      }),
    ).rejects.toThrow();
  });
});

describe("regenerateWeek: replaces a week's drafts, and only its drafts", () => {
  beforeEach(async () => {
    await prisma.post.deleteMany();
    await prisma.plan.deleteMany();
    await prisma.client.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // Generate a week, then set some of its Posts to non-draft statuses. Returns
  // the week's Posts keyed by the day they are scheduled on.
  async function seedWeek(statuses: Partial<Record<"Monday" | "Wednesday" | "Friday", string>> = {}) {
    const client = await seedClient();
    await generateWeek({
      clientId: client.id,
      weekStart: WEEK_START,
      caller: fakeCaller(responsesFor(3)).caller,
    });
    const posts = await prisma.post.findMany({ orderBy: { scheduledDate: "asc" } });
    const byDay = { Monday: posts[0], Wednesday: posts[1], Friday: posts[2] };
    for (const [day, status] of Object.entries(statuses)) {
      await prisma.post.update({
        where: { id: byDay[day as keyof typeof byDay].id },
        data: { status },
      });
    }
    return { client, byDay };
  }

  it("discards the week's drafts and creates fresh ones under the same Plan", async () => {
    const { client, byDay } = await seedWeek();
    const oldIds = Object.values(byDay).map((p) => p.id);

    const result = await regenerateWeek({
      clientId: client.id,
      weekStart: WEEK_START,
      caller: fakeCaller(responsesFor(3, plannerFor(["Monday", "Wednesday", "Friday"]))).caller,
    });

    expect(result.ok).toBe(true);

    const posts = await prisma.post.findMany({ orderBy: { scheduledDate: "asc" } });
    expect(posts).toHaveLength(3);
    // Every old draft is gone; every Post is one of the fresh ones.
    expect(posts.some((p) => oldIds.includes(p.id))).toBe(false);
    expect(posts.every((p) => p.topic.startsWith("REGEN"))).toBe(true);
    expect(posts.every((p) => p.status === "draft")).toBe(true);

    // Still ONE "Week of ..." Plan — regeneration reuses it rather than adding
    // the second column the duplicate-week block exists to prevent.
    const plans = await prisma.plan.findMany();
    expect(plans).toHaveLength(1);
    expect(new Set(posts.map((p) => p.planId))).toEqual(new Set([plans[0].id]));
  });

  it("leaves approved and published Posts completely untouched", async () => {
    const { client, byDay } = await seedWeek({
      Monday: "approved",
      Wednesday: "published",
    });
    const before = await prisma.post.findMany({
      where: { id: { in: [byDay.Monday.id, byDay.Wednesday.id] } },
      orderBy: { scheduledDate: "asc" },
    });

    await regenerateWeek({
      clientId: client.id,
      weekStart: WEEK_START,
      caller: fakeCaller(responsesFor(1, plannerFor(["Friday"]))).caller,
    });

    const after = await prisma.post.findMany({
      where: { id: { in: [byDay.Monday.id, byDay.Wednesday.id] } },
      orderBy: { scheduledDate: "asc" },
    });

    // Not "equivalent" — identical. Same rows, same copy, same status. This is
    // work the operator committed or already made public.
    expect(after).toHaveLength(2);
    expect(after).toEqual(before);
  });

  it("regenerates only the drafts in a mixed week, refilling just their days", async () => {
    const { client, byDay } = await seedWeek({
      Monday: "approved",
      Wednesday: "published",
    });

    // Only Friday is a draft, so the planner is asked for Friday alone — one
    // planner call and one copywriter call, not three.
    const { caller, calls } = fakeCaller(responsesFor(1, plannerFor(["Friday"])));
    const result = await regenerateWeek({
      clientId: client.id,
      weekStart: WEEK_START,
      caller,
    });

    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(2); // planner + one copywriter
    expect(calls[0].user).toContain("Friday");
    expect(calls[0].user).not.toContain("Patient Education"); // Monday's pillar — that slot is taken

    const posts = await prisma.post.findMany({ orderBy: { scheduledDate: "asc" } });
    // The week still holds exactly three posts — one per day, no doubling up.
    expect(posts).toHaveLength(3);
    expect(posts.map((p) => p.status)).toEqual(["approved", "published", "draft"]);
    expect(posts[0].id).toBe(byDay.Monday.id);
    expect(posts[1].id).toBe(byDay.Wednesday.id);
    expect(posts[2].id).not.toBe(byDay.Friday.id); // replaced
    expect(posts[2].topic).toBe("REGEN Friday — guess the toothbrush era");
  });

  it("drops discarded drafts' topics from the avoid-list, but keeps the surviving posts' topics on it", async () => {
    const { client, byDay } = await seedWeek({ Monday: "approved" });

    const { caller, calls } = fakeCaller(
      responsesFor(2, plannerFor(["Wednesday", "Friday"])),
    );
    await regenerateWeek({ clientId: client.id, weekStart: WEEK_START, caller });

    const plannerUser = calls[0].user;
    // The operator is throwing these two away — their subjects must not steer
    // the retry away from the very ground it should be free to cover again.
    expect(plannerUser).not.toContain(byDay.Wednesday.topic);
    expect(plannerUser).not.toContain(byDay.Friday.topic);
    // The approved Monday post is still real content — still avoid repeating it.
    expect(plannerUser).toContain(byDay.Monday.topic);
  });

  it("leaves the old drafts in place when generation fails — never deleted with no replacement", async () => {
    const { client, byDay } = await seedWeek();
    const before = await prisma.post.findMany({ orderBy: { scheduledDate: "asc" } });

    // Planner returns unparseable text on both attempts.
    const garbage = { text: "no JSON here at all", promptTokens: 50, outputTokens: 5 };
    const result = await regenerateWeek({
      clientId: client.id,
      weekStart: WEEK_START,
      caller: fakeCaller([garbage, garbage]).caller,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("planner");

    // The week is exactly as it was — a failed regeneration is a no-op, not a
    // week emptied of drafts with nothing to show for it.
    const after = await prisma.post.findMany({ orderBy: { scheduledDate: "asc" } });
    expect(after).toEqual(before);
    expect(after.map((p) => p.id)).toEqual(Object.values(byDay).map((p) => p.id));
    expect(await prisma.plan.count()).toBe(1);
  });

  it("refuses a week with nothing to discard, without calling the model", async () => {
    const { client } = await seedWeek({
      Monday: "approved",
      Wednesday: "published",
      Friday: "approved",
    });
    const before = await prisma.post.findMany({ orderBy: { scheduledDate: "asc" } });
    const { caller, calls } = fakeCaller([]); // any call would throw

    const result = await regenerateWeek({ clientId: client.id, weekStart: WEEK_START, caller });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/approved or published/i);
    expect(calls).toHaveLength(0);
    expect(await prisma.post.findMany({ orderBy: { scheduledDate: "asc" } })).toEqual(before);
  });

  it("refuses to regenerate a week that has no plan yet", async () => {
    const client = await seedClient();

    const result = await regenerateWeek({
      clientId: client.id,
      weekStart: WEEK_START,
      caller: fakeCaller([]).caller,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/generate this week/i);
  });
});

describe("weekPlanSummary: what the dashboard needs to decide and to confirm", () => {
  beforeEach(async () => {
    await prisma.post.deleteMany();
    await prisma.plan.deleteMany();
    await prisma.client.deleteMany();
  });

  it("is null for a week with no plan", async () => {
    const client = await seedClient();
    expect(await weekPlanSummary(client.id, WEEK_START)).toBeNull();
  });

  it("reports the label and the number of drafts a regeneration would replace", async () => {
    const client = await seedClient();
    await generateWeek({
      clientId: client.id,
      weekStart: WEEK_START,
      caller: fakeCaller(responsesFor(3)).caller,
    });

    const posts = await prisma.post.findMany({ orderBy: { scheduledDate: "asc" } });
    await prisma.post.update({ where: { id: posts[0].id }, data: { status: "approved" } });
    await prisma.post.update({ where: { id: posts[1].id }, data: { status: "published" } });

    // The count the confirmation states must be the count that actually goes —
    // drafts only, never the whole week.
    expect(await weekPlanSummary(client.id, WEEK_START)).toEqual({
      label: "Week of 2026-07-20",
      draftCount: 1,
    });
  });
});
