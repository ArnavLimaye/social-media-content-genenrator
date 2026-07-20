import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { approvePost, publishPost, updatePostField } from "@/lib/posts";

// Issue #10 — the persistence half of the lifecycle. `lib/post-status.ts` owns
// the rules as pure logic (tests/post-status.spec.ts); these tests cover what
// the database records when a rule passes, and that a rule violation is
// *refused at the data layer* rather than only hidden in the UI. The
// acknowledgment gate is the v1 medical-accuracy safeguard, so a server action
// must not be able to walk around it.

describe("Post lifecycle: approving, publishing, and the read-only record", () => {
  beforeEach(async () => {
    await prisma.post.deleteMany();
    await prisma.plan.deleteMany();
    await prisma.client.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function seedClient() {
    return prisma.client.create({
      data: {
        name: "Lakeside Dental",
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
        scheduledDate: new Date("2026-07-20T09:00:00Z"),
        ...overrides,
      } as never,
    });
  }

  const flags = [
    { claim: "Whitening is completely safe for everyone", reason: "absolute safety claim" },
  ];

  it("approves a clean draft in one call, writing no acknowledgment timestamp", async () => {
    const client = await seedClient();
    const post = await seedPost(client.id);

    await approvePost(post.id, false);

    const reloaded = await prisma.post.findUniqueOrThrow({ where: { id: post.id } });
    expect(reloaded.status).toBe("approved");
    // nothing was flagged, so there is nothing to have reviewed
    expect(reloaded.flagsAcknowledgedAt).toBeNull();
  });

  it("records flagsAcknowledgedAt when a flagged draft is approved with acknowledgment", async () => {
    const client = await seedClient();
    const post = await seedPost(client.id, { reviewFlags: flags });

    await approvePost(post.id, true);

    const reloaded = await prisma.post.findUniqueOrThrow({ where: { id: post.id } });
    expect(reloaded.status).toBe("approved");
    expect(reloaded.flagsAcknowledgedAt).toBeInstanceOf(Date);
  });

  it("leaves a flagged draft untouched when the operator declines", async () => {
    // Declining the confirmation must be a true no-op: still a draft, and no
    // timestamp claiming a human reviewed these claims.
    const client = await seedClient();
    const post = await seedPost(client.id, { reviewFlags: flags });

    await expect(approvePost(post.id, false)).rejects.toThrow();

    const reloaded = await prisma.post.findUniqueOrThrow({ where: { id: post.id } });
    expect(reloaded.status).toBe("draft");
    expect(reloaded.flagsAcknowledgedAt).toBeNull();
  });

  it("marks an approved Post published, recording publishedAt", async () => {
    const client = await seedClient();
    const post = await seedPost(client.id, { status: "approved" });

    await publishPost(post.id);

    const reloaded = await prisma.post.findUniqueOrThrow({ where: { id: post.id } });
    expect(reloaded.status).toBe("published");
    expect(reloaded.publishedAt).toBeInstanceOf(Date);
  });

  it("refuses to publish a draft directly, skipping review", async () => {
    const client = await seedClient();
    const post = await seedPost(client.id);

    await expect(publishPost(post.id)).rejects.toThrow();

    const reloaded = await prisma.post.findUniqueOrThrow({ where: { id: post.id } });
    expect(reloaded.status).toBe("draft");
    expect(reloaded.publishedAt).toBeNull();
  });

  it("refuses to edit a published Post — the record of what went out is fixed", async () => {
    const client = await seedClient();
    const post = await seedPost(client.id, { status: "published" });

    await expect(
      updatePostField(post.id, "caption", "quietly rewritten after the fact"),
    ).rejects.toThrow();

    const reloaded = await prisma.post.findUniqueOrThrow({ where: { id: post.id } });
    expect(reloaded.caption).toBe("Don't brush past bleeding gums.");
  });
});
