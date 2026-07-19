import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { generateThisWeek } from "@/app/clients/[id]/actions";

// Issue #6 — the generateThisWeek server action: a thin shell over the tested
// generateWeek orchestrator (issue #5). It computes the current week's Monday
// and hands the real callOllama caller to the orchestrator, mapping the
// resulting Posts to the serializable DraftPost shape the dashboard renders.
//
// The happy path needs live Ollama and is already covered by the orchestrator's
// behavior tests; this spec covers the one no-network case — an unknown client
// returns ok:false naming the client and writes nothing (the orchestrator
// returns before ever calling the model).

describe("generateThisWeek server action", () => {
  beforeEach(async () => {
    await prisma.post.deleteMany();
    await prisma.plan.deleteMany();
    await prisma.client.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns ok:false naming the client for an unknown clientId and writes nothing", async () => {
    const beforePlans = await prisma.plan.count();
    const beforePosts = await prisma.post.count();

    const result = await generateThisWeek("does-not-exist");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("client");

    expect(await prisma.plan.count()).toBe(beforePlans);
    expect(await prisma.post.count()).toBe(beforePosts);
  });
});