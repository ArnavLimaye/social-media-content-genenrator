// PLANNER AGENT PROMPT
// -----------------------------------------------------------------------------
// Role: given a clinic's pillars + audience, produce a week's worth of post
// TOPICS (not copy — just the plan). Copywriter turns these into captions later.
//
// Design notes:
// - Output is STRICT JSON. No prose, no markdown, no ```json fences. The generate
//   endpoint does JSON.parse() directly on the response, so any stray text breaks it.
// - `recentTopics` is how you avoid month-over-month repetition WITHOUT a memory
//   system: the endpoint passes in the topics of the client's last 21 posts, and
//   the planner is told to avoid them. Cheap, effective, no vector DB needed.
// - One post per pillar per week (Mon/Wed/Fri). Keep it to exactly 3.
// - Model suggestion: a mid/large instruction-following model (Qwen/DeepSeek class).
//   Planning benefits from a capable model; this is not the place to go tiny.
// - Suggested max_tokens: ~800 (topics are short; this is your per-agent cap).

// The Mon/Wed/Fri shape is a hardcoded constant (ADR-0002); `days` narrows
// *which* of those three a given call plans, never adds a fourth.
export type PlannerDay = "Monday" | "Wednesday" | "Friday";
export const ALL_DAYS: PlannerDay[] = ["Monday", "Wednesday", "Friday"];

function countWord(n: number): string {
  return ["zero", "one", "two", "three"][n] ?? String(n);
}

function listDays(days: PlannerDay[]): string {
  if (days.length === 1) return days[0];
  return `${days.slice(0, -1).join(", ")} and ${days[days.length - 1]}`;
}

// Builds the system message. The dental framing + medical guardrail are injected
// via `domainProfile` (ADR-0002 seam — see lib/prompts/domain.ts) rather than
// baked in, so the domain can be swapped by replacing that one string.
export function buildPlannerSystem(
  domainProfile: string,
  // Which days to plan. A full week is all three; a regeneration (issue #11)
  // passes only the days whose drafts were discarded, so the planner is never
  // asked for a topic that would land on top of an approved or published Post.
  days: PlannerDay[] = ALL_DAYS,
): string {
  const shape = days
    .map(
      (day) =>
        `    { "day": "${day}", "pillar": "<the ${day} pillar>", "format": "carousel" | "reel" | "infographic", "topic": "<specific, concrete topic>", "objective": "<one sentence: what this post should achieve>" }`,
    )
    .join(",\n");

  return `You are the content planner for a clinic's social media. You produce a content plan: exactly ${countWord(days.length)} post ${days.length === 1 ? "topic" : "topics"}, one for each of these days — ${listDays(days)} — matching that day's pillar.

${domainProfile}

You output ONLY valid JSON matching this exact shape, with no surrounding text, no explanation, and no markdown code fences:

{
  "posts": [
${shape}
  ]
}

Rules:
- Plan ONLY the ${days.length === 1 ? "day" : "days"} listed above. Do not add posts for any other day.
- Topics must be SPECIFIC ("Why bleeding gums are not normal — 3 causes"), never vague ("dental health tips").
- Match the format to the pillar: education pillars favour carousels/infographics; engagement pillars favour reels/interactive formats.
- Do NOT reuse or lightly reword any topic listed in the "recently used" set. Pick genuinely new angles.
- Stay within the domain scope and follow the medical guardrail above strictly.`;
}

// Builds the user message. Call site fills these from the Client row + recent posts.
export function buildPlannerUser(input: {
  clinicName: string;
  location?: string;
  audience?: string;
  pillarMon: string;
  pillarWed: string;
  pillarFri: string;
  recentTopics: string[]; // topics of the client's last 21 posts (7 weeks)
  days?: PlannerDay[]; // defaults to the full week
}): string {
  const days = input.days ?? ALL_DAYS;
  const recent =
    input.recentTopics.length > 0
      ? input.recentTopics.map((t) => `- ${t}`).join("\n")
      : "(none yet)";

  // Only the pillars for the days being planned. A regeneration that is
  // refilling Friday alone should not see Monday's pillar — that slot is
  // already filled by an approved or published Post.
  const pillarFor: Record<PlannerDay, string> = {
    Monday: input.pillarMon,
    Wednesday: input.pillarWed,
    Friday: input.pillarFri,
  };
  const pillars = days.map((d) => `- ${d}: ${pillarFor[d]}`).join("\n");

  return `Clinic: ${input.clinicName}
Location: ${input.location ?? "not specified"}
Audience: ${input.audience ?? "general local patients"}

Pillars:
${pillars}

Recently used topics (do NOT repeat or lightly reword these):
${recent}

Produce the plan for ${listDays(days)} as JSON — ${countWord(days.length)} ${days.length === 1 ? "post" : "posts"}.`;
}
