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

// Builds the system message. The dental framing + medical guardrail are injected
// via `domainProfile` (ADR-0002 seam — see lib/prompts/domain.ts) rather than
// baked in, so the domain can be swapped by replacing that one string.
export function buildPlannerSystem(domainProfile: string): string {
  return `You are the content planner for a clinic's social media. You produce a weekly content plan: exactly three post topics, one for each pillar (Monday, Wednesday, Friday).

${domainProfile}

You output ONLY valid JSON matching this exact shape, with no surrounding text, no explanation, and no markdown code fences:

{
  "posts": [
    { "day": "Monday",    "pillar": "<the Monday pillar>",    "format": "carousel" | "reel" | "infographic", "topic": "<specific, concrete topic>", "objective": "<one sentence: what this post should achieve>" },
    { "day": "Wednesday", "pillar": "<the Wednesday pillar>", "format": "carousel" | "reel" | "infographic", "topic": "<specific, concrete topic>", "objective": "<one sentence>" },
    { "day": "Friday",    "pillar": "<the Friday pillar>",    "format": "carousel" | "reel" | "infographic", "topic": "<specific, concrete topic>", "objective": "<one sentence>" }
  ]
}

Rules:
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
}): string {
  const recent =
    input.recentTopics.length > 0
      ? input.recentTopics.map((t) => `- ${t}`).join("\n")
      : "(none yet)";

  return `Clinic: ${input.clinicName}
Location: ${input.location ?? "not specified"}
Audience: ${input.audience ?? "general local patients"}

Pillars:
- Monday: ${input.pillarMon}
- Wednesday: ${input.pillarWed}
- Friday: ${input.pillarFri}

Recently used topics (do NOT repeat or lightly reword these):
${recent}

Produce this week's three-post plan as JSON.`;
}
