// GENERATE-WEEK ORCHESTRATOR (issue #5)
// -----------------------------------------------------------------------------
// The one genuinely non-CRUD piece: given a Client and a target week, run the
// Planner once (3 topics) and the Copywriter once per topic, then write one
// Plan (period: "week") plus three draft Posts in a single transaction.
//
// Ollama is injected via agent-json's `caller` so this module is fully testable
// with a fake — no network in the test suite. The route handler wires the real
// `callOllama` as the caller.
//
// Per-post graceful failure: if one copywriter call fails after its repair
// retry, the batch still succeeds — that Post is created from the planner's
// data with empty copy fields, and a warning names it. A planner failure aborts
// the whole generation cleanly with nothing written.

import { agentJson, type Caller, type CallUsage } from "@/lib/agent-json";
import { prisma } from "@/lib/db";
import { Prisma, type Post } from "@/generated/prisma/client";
import { scheduleDates, type DayName } from "@/lib/schedule-dates";
import { DOMAIN_PROFILE } from "@/lib/prompts/domain";
import { buildPlannerSystem, buildPlannerUser } from "@/lib/prompts/planner";
import { buildCopywriterSystem, buildCopywriterUser } from "@/lib/prompts/copywriter";

// Generous runaway guards, not budgets — Ollama Cloud bills GPU-time, not
// tokens, so a high cap costs nothing and prevents the truncation that is the
// main cause of invalid JSON (issue #5). Token counts are logged only.
const PLANNER_MAX_TOKENS = 1500;
const COPYWRITER_MAX_TOKENS = 4000;

const PLANNER_MODEL = process.env.OLLAMA_PLANNER_MODEL ?? "qwen2.5:32b";
const COPYWRITER_MODEL = process.env.OLLAMA_COPYWRITER_MODEL ?? "qwen2.5:32b";

const DAYS: DayName[] = ["Monday", "Wednesday", "Friday"];

export type PlannerPost = {
  day: string;
  pillar: string;
  format: string;
  topic: string;
  objective: string;
};

export type PlannerOutput = { posts: PlannerPost[] };

export type CopywriterOutput = {
  hook: string;
  slides: Array<{
    heading: string;
    description: string;
    imageIdeas: Array<{ type: string; idea: string }>;
  }>;
  caption: string;
  cta: string;
  hashtags: string[];
  reviewFlags: Array<{ claim: string; reason: string }>;
};

export type GenerateWeekResult =
  | { ok: true; plan: { id: string; label: string }; posts: Post[]; warnings: string[] }
  | { ok: false; error: string };

export async function generateWeek(opts: {
  clientId: string;
  weekStart: Date; // a Monday
  caller: Caller; // injected — fake in tests, callOllama in the route
  domainProfile?: string; // defaults to DOMAIN_PROFILE (ADR-0002 seam)
}): Promise<GenerateWeekResult> {
  const { clientId, weekStart, caller } = opts;
  const domainProfile = opts.domainProfile ?? DOMAIN_PROFILE;

  // 1. Load the client.
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return { ok: false, error: "client not found" };

  // 2. Load the last 21 post topics — the dedup avoid-list (any status).
  const recent = await prisma.post.findMany({
    where: { clientId },
    orderBy: { createdAt: "desc" },
    take: 21,
    select: { topic: true },
  });
  const recentTopics = recent.map((r) => r.topic);

  // 3. Run the planner once.
  const planner = await agentJson<PlannerOutput>({
    caller,
    call: {
      model: PLANNER_MODEL,
      system: buildPlannerSystem(domainProfile),
      user: buildPlannerUser({
        clinicName: client.name,
        location: client.location ?? undefined,
        audience: client.audience ?? undefined,
        pillarMon: client.pillarMon,
        pillarWed: client.pillarWed,
        pillarFri: client.pillarFri,
        recentTopics,
      }),
      maxTokens: PLANNER_MAX_TOKENS,
    },
  });
  if (!planner.ok) return { ok: false, error: `planner failed: ${planner.error}` };

  // 4. Validate the planner output: exactly three Mon/Wed/Fri posts, all fields present.
  const planned = planner.value.posts;
  const validation = validatePlannedPosts(planned);
  if (!validation.ok) return { ok: false, error: `planner failed: ${validation.error}` };

  const plannerTokens = sumUsage(planner.calls);

  // 5. Derive the Mon/Wed/Fri scheduledDates from the week start.
  const dates = scheduleDates(weekStart);

  // 6. Run the copywriter once per topic. Failures are per-post: a failed
  //    copywriter yields a topic-only Post with empty copy + a warning, never
  //    a failed batch. Network calls happen here, before the DB transaction.
  const warnings: string[] = [];
  const drafts: Array<{
    planned: PlannerPost;
    scheduledDate: Date;
    copy: CopywriterOutput | null;
    copywriterTokens: { promptTokens: number; outputTokens: number };
  }> = [];
  for (const plannedPost of planned) {
    const scheduledDate = dates[plannedPost.day as DayName];
    const copy = await agentJson<CopywriterOutput>({
      caller,
      call: {
        model: COPYWRITER_MODEL,
        system: buildCopywriterSystem(domainProfile),
        user: buildCopywriterUser({
          clinicName: client.name,
          brandVoice: client.brandVoice ?? undefined,
          pillar: plannedPost.pillar,
          format: plannedPost.format,
          topic: plannedPost.topic,
          objective: plannedPost.objective,
        }),
        maxTokens: COPYWRITER_MAX_TOKENS,
      },
    });
    const copywriterTokens = sumUsage(copy.calls);

    if (copy.ok) {
      drafts.push({
        planned: plannedPost,
        scheduledDate,
        copy: copy.value,
        copywriterTokens,
      });
    } else {
      drafts.push({ planned: plannedPost, scheduledDate, copy: null, copywriterTokens });
      warnings.push(`Copywriter failed for "${plannedPost.topic}" — regenerate this post`);
    }
  }

  // 7. Write the Plan + three Posts in a single transaction. All or nothing.
  const label = `Week of ${isoDate(weekStart)}`;
  const created = await prisma.$transaction(async (tx) => {
    const plan = await tx.plan.create({
      data: { clientId, period: "week", label },
    });
    const posts: Post[] = [];
    for (const d of drafts) {
      posts.push(
        await tx.post.create({
          data: {
            clientId,
            planId: plan.id,
            pillar: d.planned.pillar,
            format: d.planned.format,
            topic: d.planned.topic,
            objective: d.planned.objective,
            scheduledDate: d.scheduledDate,
            hook: d.copy?.hook ?? null,
            caption: d.copy?.caption ?? null,
            cta: d.copy?.cta ?? null,
            slides: d.copy?.slides ?? Prisma.DbNull,
            hashtags: d.copy?.hashtags ?? Prisma.DbNull,
            reviewFlags: d.copy?.reviewFlags ?? Prisma.DbNull,
            plannerPromptTokens: plannerTokens.promptTokens,
            plannerOutputTokens: plannerTokens.outputTokens,
            copywriterPromptTokens: d.copywriterTokens.promptTokens,
            copywriterOutputTokens: d.copywriterTokens.outputTokens,
          },
        }),
      );
    }
    return { plan, posts };
  });

  return { ok: true, plan: { id: created.plan.id, label: created.plan.label }, posts: created.posts, warnings };
}

// --- helpers ---------------------------------------------------------------

function sumUsage(calls: CallUsage[]): { promptTokens: number; outputTokens: number } {
  return calls.reduce(
    (acc, c) => ({ promptTokens: acc.promptTokens + c.promptTokens, outputTokens: acc.outputTokens + c.outputTokens }),
    { promptTokens: 0, outputTokens: 0 },
  );
}

function isoDate(d: Date): string {
  // YYYY-MM-DD in the Date's own UTC time — matches the weekStart we receive.
  return d.toISOString().slice(0, 10);
}

function validatePlannedPosts(posts: PlannerPost[] | undefined | null):
  | { ok: true }
  | { ok: false; error: string } {
  if (!Array.isArray(posts) || posts.length !== 3) {
    return { ok: false, error: "planner did not return exactly three posts" };
  }
  const daySet = new Set<string>(DAYS);
  const seenDays = new Set<string>();
  for (const p of posts) {
    if (!daySet.has(p.day)) return { ok: false, error: `planner returned invalid day: ${p.day}` };
    if (seenDays.has(p.day)) return { ok: false, error: `planner returned duplicate day: ${p.day}` };
    seenDays.add(p.day);
    for (const field of ["pillar", "format", "topic", "objective"] as const) {
      if (typeof p[field] !== "string" || p[field].trim() === "") {
        return { ok: false, error: `planner post missing ${field}` };
      }
    }
  }
  return { ok: true };
}