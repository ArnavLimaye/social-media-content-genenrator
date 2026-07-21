import { prisma } from "@/lib/db";

// What a generation costs, per agent — the number behind the dashboard's token
// panel.
//
// Reported as an AVERAGE PER GENERATION rather than a running total, because
// the total only answers "how much have I spent", which grows forever and says
// nothing actionable. The average answers "what does a week of content cost me",
// which is the number an operator can actually plan against — and it is
// comparable across clinics with different histories.
//
// A generation is a Plan, not a Post: the planner runs once per week and the
// copywriter runs once per Post, so dividing by Posts would understate the
// planner's share by a factor of three.

export type TokenUsage = {
  planner: number;
  copywriter: number;
  generations: number;
};

// Prompt AND output tokens, because both are billed and an operator comparing
// agents cares about the total each one costs, not the direction of travel.
function sum(...values: Array<number | null>): number {
  return values.reduce<number>((n, v) => n + (v ?? 0), 0);
}

export async function tokenUsageSince(
  clientId: string,
  since: Date,
): Promise<TokenUsage> {
  const posts = await prisma.post.findMany({
    where: { clientId, createdAt: { gte: since } },
    select: {
      planId: true,
      plannerPromptTokens: true,
      plannerOutputTokens: true,
      copywriterPromptTokens: true,
      copywriterOutputTokens: true,
    },
  });

  // Posts generated before token logging existed carry nulls throughout. They
  // are excluded rather than counted as zero, which would drag the average down
  // and misreport what a generation costs today.
  const counted = posts.filter(
    (p) =>
      sum(
        p.plannerPromptTokens,
        p.plannerOutputTokens,
        p.copywriterPromptTokens,
        p.copywriterOutputTokens,
      ) > 0,
  );

  if (counted.length === 0) return { planner: 0, copywriter: 0, generations: 0 };

  // A Post with no Plan is its own generation — regeneration of a single Post
  // detaches it (onDelete: SetNull), and pooling every orphan under one bucket
  // would count many generations as one.
  const generations = new Set(
    counted.map((p, i) => p.planId ?? `orphan:${i}`),
  ).size;

  const planner = counted.reduce(
    (n, p) => n + sum(p.plannerPromptTokens, p.plannerOutputTokens),
    0,
  );
  const copywriter = counted.reduce(
    (n, p) => n + sum(p.copywriterPromptTokens, p.copywriterOutputTokens),
    0,
  );

  return {
    planner: Math.round(planner / generations),
    copywriter: Math.round(copywriter / generations),
    generations,
  };
}

// The dashboard's window: the last 30 days. A calendar month would make the
// figure collapse on the 1st of each month, when it is least useful.
export function thirtyDaysBefore(now: Date): Date {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - 30);
  return d;
}
