import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import {
  setSlideField,
  listPostsForClient,
  updatePostField,
  updatePostHashtags,
  updatePostSlide,
  type Slide,
} from "@/lib/posts";

// Issue #8 — the Board's data layer: a deep module (`lib/posts.ts`) behind the
// kanban board and its inline editing. The board reads a Client's Posts and
// edits copy in place; slide edits rewrite the `slides` Json document (ADR-0001)
// rather than touching per-slide rows.
//
// `setSlideField` is the heart of the inline-edit behavior and the issue's
// explicit correctness requirement: "Editing a slide field rewrites the slides
// document without corrupting other slides or their image ideas." It is a pure,
// immutable function — exported so it is tested directly, independent of the
// database — and the DB-backed `updatePostSlide` is a thin shell over it.

const slidesFixture = (): Slide[] => [
  {
    heading: "Bleeding gums? Read this",
    description: "3 causes you can spot at home",
    imageIdeas: [
      { type: "photo", idea: "close-up of healthy vs inflamed gumline" },
      { type: "creative", idea: "icon trio: floss, brush, rinse" },
    ],
  },
  {
    heading: "Cause 1",
    description: "Plaque buildup along the gumline",
    imageIdeas: [{ type: "creative", idea: "diagram of plaque layer" }],
  },
];

describe("setSlideField: rewrite one slide field without corrupting the rest", () => {
  it("updates slide[1].heading and leaves slide[0] and every image idea intact", () => {
    const before = slidesFixture();
    const after = setSlideField(before, 1, "heading", "Cause 1: plaque");

    // the targeted field changed
    expect(after[1].heading).toBe("Cause 1: plaque");

    // the other slide is untouched — heading, description, and both image ideas
    expect(after[0]).toEqual(before[0]);
    expect(after[0].imageIdeas).toHaveLength(2);
    expect(after[0].imageIdeas[0]).toMatchObject({ type: "photo" });

    // the edited slide's own description + image idea survive too
    expect(after[1].description).toBe("Plaque buildup along the gumline");
    expect(after[1].imageIdeas).toEqual(before[1].imageIdeas);
  });

  it("is immutable — the input document is not mutated", () => {
    const before = slidesFixture();
    const beforeCopy = JSON.parse(JSON.stringify(before)) as Slide[];
    setSlideField(before, 0, "description", "edited");
    expect(before).toEqual(beforeCopy);
  });
});

// DB-backed behavior: reads + edits against the isolated test.db, like
// clients.spec.ts. Each spec owns the tables for its run (fileParallelism is
// off, and beforeEach wipes rows).
describe("Board data layer: reads + edits round-trip", () => {
  beforeAll(async () => {
    // migrations applied to test.db by vitest.global-setup.ts
  });

  beforeEach(async () => {
    await prisma.post.deleteMany();
    await prisma.plan.deleteMany();
    await prisma.client.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function seedClient(name: string) {
    return prisma.client.create({
      data: {
        name,
        pillarMon: "Patient Education",
        pillarWed: "Trust & Clinic Branding",
        pillarFri: "Engagement / Fun",
      },
    });
  }

  async function seedPost(
    clientId: string,
    overrides: Record<string, unknown> = {},
  ) {
    return prisma.post.create({
      data: {
        clientId,
        pillar: "Patient Education",
        format: "carousel",
        topic: "Why bleeding gums are not normal",
        objective: "Teach patients to recognise gingivitis early",
        hook: "Bleeding gums are not a flex.",
        caption: "Don't brush past bleeding gums.",
        cta: "Book a checkup.",
        hashtags: ["#dentalcare", "#gumhealth"],
        slides: slidesFixture(),
        scheduledDate: new Date("2026-07-20T09:00:00Z"),
        ...overrides,
      } as never,
    });
  }

  it("listPostsForClient returns only that Client's posts, scheduledDate as an ISO string", async () => {
    const a = await seedClient("Lakeside Dental");
    const b = await seedClient("Brightside Dental");

    await seedPost(a.id, { topic: "Lakeside Monday post" });
    await seedPost(a.id, {
      topic: "Lakeside Wednesday post",
      scheduledDate: new Date("2026-07-22T09:00:00Z"),
    });
    // another client's post must NOT appear
    await seedPost(b.id, { topic: "Brightside post" });

    const posts = await listPostsForClient(a.id);

    expect(posts).toHaveLength(2);
    expect(posts.map((p) => p.topic)).toEqual(
      expect.arrayContaining([
        "Lakeside Monday post",
        "Lakeside Wednesday post",
      ]),
    );
    expect(posts.map((p) => p.topic)).not.toContain("Brightside post");

    // Date crossed the server→client boundary as an ISO string, not a Date
    const monday = posts.find((p) => p.topic === "Lakeside Monday post");
    expect(typeof monday?.scheduledDate).toBe("string");
    expect(monday?.scheduledDate).toBe("2026-07-20T09:00:00.000Z");
  });

  it("updatePostField persists an edited scalar field (hook) and reads it back", async () => {
    const client = await seedClient("Lakeside Dental");
    const post = await seedPost(client.id);

    await updatePostField(post.id, "hook", "Bleeding gums? Don't ignore them.");

    const reloaded = await prisma.post.findUniqueOrThrow({ where: { id: post.id } });
    expect(reloaded.hook).toBe("Bleeding gums? Don't ignore them.");
    // untouched fields stay as they were
    expect(reloaded.caption).toBe("Don't brush past bleeding gums.");
  });

  it("updatePostHashtags persists the hashtag array", async () => {
    const client = await seedClient("Lakeside Dental");
    const post = await seedPost(client.id);

    await updatePostHashtags(post.id, ["#gumhealth", "#austindentist", "#booknow"]);

    const reloaded = await prisma.post.findUniqueOrThrow({ where: { id: post.id } });
    expect(reloaded.hashtags as string[]).toEqual([
      "#gumhealth",
      "#austindentist",
      "#booknow",
    ]);
  });

  it("updatePostSlide rewrites the slides document, persisting the edit without corrupting other slides or their image ideas", async () => {
    // The issue's explicit correctness requirement. Editing slide[1].heading
    // must read back with the new heading, while slide[0] and every image idea
    // on both slides are byte-for-byte unchanged (ADR-0001: one document rewrite).
    const client = await seedClient("Lakeside Dental");
    const post = await seedPost(client.id);

    await updatePostSlide(post.id, 1, "heading", "Cause 1: plaque buildup");

    const reloaded = await prisma.post.findUniqueOrThrow({ where: { id: post.id } });
    const slides = reloaded.slides as unknown as Slide[];

    expect(slides[1].heading).toBe("Cause 1: plaque buildup");
    // the edited slide's own description + image idea survive
    expect(slides[1].description).toBe("Plaque buildup along the gumline");
    expect(slides[1].imageIdeas).toEqual([
      { type: "creative", idea: "diagram of plaque layer" },
    ]);
    // the other slide is entirely untouched
    expect(slides[0]).toEqual(slidesFixture()[0]);
  });
});