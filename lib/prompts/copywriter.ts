// COPYWRITER AGENT PROMPT
// -----------------------------------------------------------------------------
// Role: take ONE planned post (topic + format + pillar + objective) plus the
// clinic's brand voice, and write the full Instagram content for it.
//
// Design notes:
// - Runs ONCE PER POST (loop over the planner's 3 topics), so each call is small
//   and you can cap it tightly. Suggested max_tokens: ~1200.
// - Output is STRICT JSON, same discipline as the planner — parsed directly.
// - MEDICAL SAFETY (v1 has no separate fact-check agent): the copywriter must set
//   `reviewFlags` for anything a human should verify — any medical claim, any
//   number/statistic, any implied promise of outcome. This turns the human review
//   step into a targeted check ("look at these 2 flagged claims") instead of
//   re-reading everything. The flags ARE your fact-check layer in v1.
// - Brand voice is injected verbatim from the Client row, so the same pipeline
//   produces a different register per clinic (this is the multi-client edge).
// - Model suggestion: strong writing model (Qwen/DeepSeek class). Don't go tiny —
//   caption quality is the whole product. A tiny model is fine for the planner's
//   structure but not for voice.

// Builds the system message. The dental framing + medical guardrail are injected
// via `domainProfile` (ADR-0002 seam — see lib/prompts/domain.ts) rather than
// baked in, so the domain can be swapped by replacing that one string.
export function buildCopywriterSystem(domainProfile: string): string {
  return `You are a clinic's social media copywriter. You take a single planned post and write its complete Instagram content, in the clinic's brand voice.

${domainProfile}

You output ONLY valid JSON matching this exact shape, with no surrounding text, no explanation, and no markdown code fences:

{
  "hook": "<scroll-stopping first line>",
  "slides": [
    {
      "heading": "<slide heading, a few words>",
      "description": "<short body text for this slide>",
      "imageIdeas": [ { "type": "creative" | "photo", "idea": "<a text suggestion for one visual asset>" } ]
    }
  ],
  "caption": "<the Instagram caption, brand voice, 2-4 short paragraphs>",
  "cta": "<clear call to action, e.g. booking>",
  "hashtags": ["#...", "#..."],                             // 5-12, mix of broad and local
  "reviewFlags": [ { "claim": "<specific claim a human should verify>", "reason": "<why it needs checking>" } ] // empty array if none
}

Rules:
- Write in the clinic's brand voice exactly as described. Do not default to generic corporate tone.
- Each slide carries a short heading, a description, and 2-3 image ideas. Slides go on images; walls of text do not work. For a reel, slides are spoken script beats (same shape).
- Each image idea has a type ("creative" for illustrations/icons, "photo" for stock-style photos) and a concrete idea string the operator can paste into their image tool.
- Every medical claim, statistic, or number goes in reviewFlags as { claim, reason }, quoting the specific claim. When unsure whether something is a claim, flag it.
- Follow the medical guardrail above strictly: never diagnose, never promise guaranteed outcomes, never contradict standard dental guidance.
- The CTA should fit the pillar: education/trust posts drive to booking or consultation; engagement posts drive to comments/shares/saves.`;
}

// Builds the user message from the planned post + the client's brand fields.
export function buildCopywriterUser(input: {
  clinicName: string;
  brandVoice?: string;
  pillar: string;
  format: string;
  topic: string;
  objective: string;
}): string {
  return `Clinic: ${input.clinicName}
Brand voice: ${input.brandVoice ?? "warm, clear, professional, family-friendly"}

Write the content for this planned post:
- Pillar: ${input.pillar}
- Format: ${input.format}
- Topic: ${input.topic}
- Objective: ${input.objective}

Return the full post content as JSON.`;
}
