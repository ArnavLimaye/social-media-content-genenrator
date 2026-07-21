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

  // Left-to-right, the three formats are genuinely different deliverables, not
  // synonyms. Without spelling that out the model collapses onto carousel/reel
  // and never picks infographic, because "carousel" is the safe default for
  // anything educational. Defining what each one IS makes the choice real.
  const formats = `Formats (pick the one that fits the topic — all three are in play):
- "carousel": a sequence of 4-8 slides that build an argument or walk through steps. Use when the topic needs ORDER — a progression, a myth-then-truth, a before/during/after.
- "reel": a short spoken-to-camera or demonstrative video. Use when the topic needs a PERSON — a demonstration, a quick answer, personality, a clinic moment.
- "infographic": ONE dense image the viewer reads in place — a comparison table, a labelled anatomical diagram, a chart, a checklist, a timeline. Use when the topic is a set of facts that make sense SIMULTANEOUSLY rather than in sequence: "how much sugar is in these 6 drinks", "what each tooth surface does", "brushing timeline by age".

Choosing: if the topic would read fine as a single wall chart pinned in a waiting room, it is an infographic, NOT a carousel. Do not default to carousel for every educational topic.`;

  // Format variety is only enforceable when planning a full week. A single-day
  // regeneration (issue #11) has nothing to vary against, so the rule is
  // omitted rather than stated and immediately violated.
  const varietyRule =
    days.length > 1
      ? `\n- Vary the format across the ${countWord(days.length)} posts. Do not return the same format for every day, and do not return only carousel + reel — a week that never uses infographic is a failed plan.`
      : "";

  return `You are the content planner for a clinic's social media. You produce a content plan: exactly ${countWord(days.length)} post ${days.length === 1 ? "topic" : "topics"}, one for each of these days — ${listDays(days)} — matching that day's pillar.

${domainProfile}

${formats}

You output ONLY valid JSON matching this exact shape, with no surrounding text, no explanation, and no markdown code fences:

{
  "posts": [
${shape}
  ]
}

Rules:
- Plan ONLY the ${days.length === 1 ? "day" : "days"} listed above. Do not add posts for any other day.
- Topics must be SPECIFIC ("Why bleeding gums are not normal — 3 causes"), never vague ("dental health tips").
- Choose the format from the topic's SHAPE using the definitions above, not from the pillar's name. An education pillar is not automatically a carousel — a fact-dense education topic is an infographic.${varietyRule}
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
