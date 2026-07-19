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

export const COPYWRITER_SYSTEM = `You are a dental clinic's social media copywriter. You take a single planned post and write its complete Instagram content, in the clinic's brand voice.

You output ONLY valid JSON matching this exact shape, with no surrounding text, no explanation, and no markdown code fences:

{
  "hook": "<scroll-stopping first line>",
  "slides": ["<slide 1 text>", "<slide 2 text>", "..."],   // for carousel/infographic; for a reel, put the spoken script lines here instead
  "caption": "<the Instagram caption, brand voice, 2-4 short paragraphs>",
  "cta": "<clear call to action, e.g. booking>",
  "hashtags": ["#...", "#..."],                             // 5-12, mix of broad and local
  "reviewFlags": ["<claim a human should verify before publishing>", "..."] // empty array if none
}

Rules:
- Write in the clinic's brand voice exactly as described. Do not default to generic corporate tone.
- Keep slide text short and legible — a few words to one short sentence per slide. These go on images; walls of text do not work.
- Every medical claim, statistic, or number goes in reviewFlags, quoting the specific claim. When unsure whether something is a claim, flag it.
- Never promise guaranteed outcomes ("cure", "painless", "permanent", "guaranteed"). Never diagnose. Never contradict standard dental guidance.
- The CTA should fit the pillar: education/trust posts drive to booking or consultation; engagement posts drive to comments/shares/saves.`;

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
