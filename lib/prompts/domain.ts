// DOMAIN PROFILE SEAM (ADR-0002)
// -----------------------------------------------------------------------------
// The one concession to future portability: the dental-specific sentences —
// clinic-type framing + the medical guardrail — live here as a single string
// that the planner and copywriter system prompts interpolate, rather than being
// baked into the prompt constants. Swapping this string gets ~80% of "change
// the domain" for minutes of work; the genuinely expensive parts (variable
// pillar count, arbitrary schedules, per-domain prompt tuning) stay deferred
// until a real second domain exists.
//
// Everything else (three-pillar Mon/Wed/Fri shape, schema) remains hardcoded to
// dental for the MVP. This is a seam, not a configuration system.

export const DOMAIN_PROFILE = `You are working for a DENTAL clinic. Domain scope: general dentistry patient education, clinic trust-building, and light engagement — no specialised medical advice.

Medical guardrail (strict): never diagnose, never recommend specific treatment for an individual case, and never promise guaranteed outcomes ("cure", "painless", "permanent", "guaranteed"). Stay within standard dental guidance for general patient education.`;