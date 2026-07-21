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
const PLANNER_MAX_TOKENS = 15000;
const COPYWRITER_MAX_TOKENS = 40000;

// Verified present on the operator's Ollama Cloud account via GET /v1/models —
// the previous default (`qwen2.5:32b`) was a placeholder that account does not
// carry, which surfaced as a bare 404 at generation time. Tags drift, so treat
// a 404 here as "re-check /v1/models", not "the code is wrong".
//
// `||` rather than `??`: an empty env value must fall back to the default, not
// override it with "" — the same trap that made an empty OLLAMA_API_KEY look
// like a bad key.
const PLANNER_MODEL = process.env.OLLAMA_PLANNER_MODEL?.trim() || "glm-5.2";
const COPYWRITER_MODEL = process.env.OLLAMA_COPYWRITER_MODEL?.trim() || "glm-5.2";

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
    // Optional here for the same reason as on `Slide` (lib/posts.ts): a model
    // that omits it yields a slide without an asset prompt, which the board
    // renders as "no prompt" — not a failed generation.
    imagePrompt?: string;
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

  // 1b. One Plan per week (issue #11). Refuse rather than produce a second
  //     "Week of ..." column for the same dates, and name the way forward —
  //     the operator wanting a different week is asking for Regenerate, which
  //     preserves whatever they have already approved. Checked before any
  //     model call so a blocked week costs nothing.
  const existing = await prisma.plan.findFirst({
    where: { clientId, period: "week", weekStart: weekKey(weekStart) },
  });
  if (existing) {
    return {
      ok: false,
      error: `This week already has a plan (${existing.label}). Use Regenerate to replace its drafts.`,
    };
  }

  // 2. Run the agents for the full week.
  const run = await runAgents({ client, weekStart, caller, domainProfile, days: DAYS });
  if (!run.ok) return run;

  // 3. Write the Plan + three Posts in a single transaction. All or nothing.
  const label = `Week of ${isoDate(weekStart)}`;
  const created = await prisma.$transaction(async (tx) => {
    const plan = await tx.plan.create({
      data: { clientId, period: "week", weekStart: weekKey(weekStart), label },
    });
    const posts = await writeDrafts(tx, {
      clientId,
      planId: plan.id,
      drafts: run.drafts,
      plannerTokens: run.plannerTokens,
    });
    return { plan, posts };
  });

  return {
    ok: true,
    plan: { id: created.plan.id, label: created.plan.label },
    posts: created.posts,
    warnings: run.warnings,
  };
}

// -----------------------------------------------------------------------------
// REGENERATE (issue #11)
//
// An explicit, deliberate redo of one week. It replaces that week's *draft*
// Posts and nothing else: approved copy is committed and published copy is
// already public, so both survive untouched and regeneration refills only the
// days the discarded drafts occupied.
//
// Ordering is the load-bearing detail. The issue describes deleting the drafts
// first so their topics fall off the avoid-list, but that would leave a week
// with its drafts destroyed and no replacements if the model then failed. So
// the drafts are instead *excluded* from the avoid-list while they still exist,
// all network work happens, and the delete + insert land together in one
// transaction at the end. Discarded ideas do not constrain the retry, and a
// failed regeneration is a no-op.
export async function regenerateWeek(opts: {
  clientId: string;
  weekStart: Date; // a Monday
  caller: Caller;
  domainProfile?: string;
}): Promise<GenerateWeekResult> {
  const { clientId, weekStart, caller } = opts;
  const domainProfile = opts.domainProfile ?? DOMAIN_PROFILE;

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return { ok: false, error: "client not found" };

  const plan = await prisma.plan.findFirst({
    where: { clientId, period: "week", weekStart: weekKey(weekStart) },
    include: { posts: true },
  });
  if (!plan) {
    return { ok: false, error: "This week has no plan yet — use Generate this week." };
  }

  const drafts = plan.posts.filter((p) => p.status === "draft");
  if (drafts.length === 0) {
    return {
      ok: false,
      error:
        "Nothing to regenerate — every post this week is approved or published, and those are never replaced.",
    };
  }

  // Refill exactly the days the discarded drafts occupied. A day held by an
  // approved or published Post is not planned at all, so regeneration can never
  // produce a second post for it.
  const days = DAYS.filter((day) => drafts.some((d) => dayOf(d.scheduledDate) === day));

  const run = await runAgents({
    client,
    weekStart,
    caller,
    domainProfile,
    days,
    excludePostIds: drafts.map((d) => d.id),
  });
  if (!run.ok) return run; // nothing deleted — the old drafts are still there

  const posts = await prisma.$transaction(async (tx) => {
    await tx.post.deleteMany({ where: { id: { in: drafts.map((d) => d.id) } } });
    return writeDrafts(tx, {
      clientId,
      planId: plan.id,
      drafts: run.drafts,
      plannerTokens: run.plannerTokens,
    });
  });

  return { ok: true, plan: { id: plan.id, label: plan.label }, posts, warnings: run.warnings };
}

// What the dashboard needs in order to choose between Generate and Regenerate,
// and to state the cost before the operator commits. Null means the week is
// free. `draftCount` counts only what a regeneration would actually discard —
// stating the whole week's post count would overstate the damage and scare the
// operator off an action that is safe for their approved work.
export async function weekPlanSummary(
  clientId: string,
  weekStart: Date,
): Promise<{ label: string; draftCount: number } | null> {
  const plan = await prisma.plan.findFirst({
    where: { clientId, period: "week", weekStart: weekKey(weekStart) },
    include: { posts: { select: { status: true } } },
  });
  if (!plan) return null;
  return {
    label: plan.label,
    draftCount: plan.posts.filter((p) => p.status === "draft").length,
  };
}

// --- shared core -----------------------------------------------------------

type DraftToWrite = {
  planned: PlannerPost;
  scheduledDate: Date;
  copy: CopywriterOutput | null;
  copywriterTokens: { promptTokens: number; outputTokens: number };
};

type AgentRunResult =
  | { ok: true; drafts: DraftToWrite[]; plannerTokens: { promptTokens: number; outputTokens: number }; warnings: string[] }
  | { ok: false; error: string };

// All the model work for a generation, and none of the writing: planner once
// for `days`, then the copywriter once per planned topic. Shared by generate
// and regenerate so the two cannot drift — the only difference between them is
// which days they ask for and which Posts they leave out of the avoid-list.
async function runAgents(opts: {
  client: { id: string; name: string; location: string | null; audience: string | null; brandVoice: string | null; pillarMon: string; pillarWed: string; pillarFri: string };
  weekStart: Date;
  caller: Caller;
  domainProfile: string;
  days: DayName[];
  excludePostIds?: string[];
}): Promise<AgentRunResult> {
  const { client, weekStart, caller, domainProfile, days, excludePostIds } = opts;

  // The last 21 post topics — the dedup avoid-list (any status), minus any
  // Post about to be discarded. A draft the operator is throwing away should
  // not steer the replacement away from its own subject.
  const recent = await prisma.post.findMany({
    where: {
      clientId: client.id,
      ...(excludePostIds?.length ? { id: { notIn: excludePostIds } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 21,
    select: { topic: true },
  });
  const recentTopics = recent.map((r) => r.topic);

  const planner = await agentJson<PlannerOutput>({
    caller,
    call: {
      model: PLANNER_MODEL,
      system: buildPlannerSystem(domainProfile, days),
      user: buildPlannerUser({
        clinicName: client.name,
        location: client.location ?? undefined,
        audience: client.audience ?? undefined,
        pillarMon: client.pillarMon,
        pillarWed: client.pillarWed,
        pillarFri: client.pillarFri,
        recentTopics,
        days,
      }),
      maxTokens: PLANNER_MAX_TOKENS,
    },
  });
  if (!planner.ok) return { ok: false, error: `planner failed: ${planner.error}` };

  const planned = planner.value.posts;
  const validation = validatePlannedPosts(planned, days);
  if (!validation.ok) return { ok: false, error: `planner failed: ${validation.error}` };

  const plannerTokens = sumUsage(planner.calls);
  const dates = scheduleDates(weekStart);

  // Failures are per-post: a failed copywriter yields a topic-only Post with
  // empty copy + a warning, never a failed batch.
  const warnings: string[] = [];
  const drafts: DraftToWrite[] = [];
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
      drafts.push({ planned: plannedPost, scheduledDate, copy: copy.value, copywriterTokens });
    } else {
      drafts.push({ planned: plannedPost, scheduledDate, copy: null, copywriterTokens });
      warnings.push(`Copywriter failed for "${plannedPost.topic}" — regenerate this post`);
    }
  }

  return { ok: true, drafts, plannerTokens, warnings };
}

// Insert the planned drafts as Posts. Takes a transaction client so both
// callers write inside their own all-or-nothing transaction.
async function writeDrafts(
  tx: Prisma.TransactionClient,
  opts: {
    clientId: string;
    planId: string;
    drafts: DraftToWrite[];
    plannerTokens: { promptTokens: number; outputTokens: number };
  },
): Promise<Post[]> {
  const { clientId, planId, drafts, plannerTokens } = opts;
  const posts: Post[] = [];
  for (const d of drafts) {
    posts.push(
      await tx.post.create({
        data: {
          clientId,
          planId,
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
  return posts;
}

// --- helpers ---------------------------------------------------------------

// Which of the three pillar days a Post sits on, from its scheduled date.
// The Post model carries no `day` column — the day is derived from
// `scheduledDate` (UTC: 1=Mon, 3=Wed, 5=Fri), the same direction ADR-0002's
// fixed Mon/Wed/Fri shape is derived in `scheduleDates`.
function dayOf(scheduledDate: Date | null): DayName | null {
  if (!scheduledDate) return null;
  switch (scheduledDate.getUTCDay()) {
    case 1:
      return "Monday";
    case 3:
      return "Wednesday";
    case 5:
      return "Friday";
    default:
      return null;
  }
}

function sumUsage(calls: CallUsage[]): { promptTokens: number; outputTokens: number } {
  return calls.reduce(
    (acc, c) => ({ promptTokens: acc.promptTokens + c.promptTokens, outputTokens: acc.outputTokens + c.outputTokens }),
    { promptTokens: 0, outputTokens: 0 },
  );
}

// The stable key for a week: its Monday at UTC midnight. `weekStartFor` hands
// back 09:00Z (the scheduling convention for a post's time of day), which is
// the right default for *scheduling* but wrong as an identity — two callers
// with different times of day on the same Monday must land on one week, not
// two. Stripping the time here is what makes the unique index bite.
export function weekKey(weekStart: Date): Date {
  const key = new Date(weekStart.getTime());
  key.setUTCHours(0, 0, 0, 0);
  return key;
}

function isoDate(d: Date): string {
  // YYYY-MM-DD in the Date's own UTC time — matches the weekStart we receive.
  return d.toISOString().slice(0, 10);
}

// Validates against the days actually requested, not a hardcoded three: a
// regeneration refilling Friday alone must get exactly one Friday post, and a
// planner that volunteers a Monday topic on top of an approved Monday Post is
// rejected rather than written.
function validatePlannedPosts(
  posts: PlannerPost[] | undefined | null,
  days: DayName[],
): { ok: true } | { ok: false; error: string } {
  if (!Array.isArray(posts) || posts.length !== days.length) {
    return {
      ok: false,
      error: `planner did not return exactly ${days.length} post(s) for ${days.join(", ")}`,
    };
  }
  const daySet = new Set<string>(days);
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