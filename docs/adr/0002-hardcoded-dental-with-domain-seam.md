# Hardcoded dental domain, with one seam for later generalization

**Status:** accepted

The vision states the domain should be "configurable" (dental today, other verticals
tomorrow). We deliberately do **not** build that generalization in the MVP. The
schema keeps a fixed three-pillar, Mon/Wed/Fri shape (`pillarMon/Wed/Fri`), and the
pipeline is dental-specific.

The one concession to future portability is a **`domainProfile` seam**: the
dental-specific sentences in the planner/copywriter system prompts (clinic-type
framing + the medical guardrail) are injected as a single string rather than baked
into the prompt constants. Swapping that string gets ~80% of "change the domain" for
minutes of work; the genuinely expensive parts (variable pillar count, arbitrary
weekly schedules, per-domain prompt tuning) are deferred until a real second domain
exists.

**Why:** "make the domain configurable" is the same over-scoping instinct as the
rejected 9-agent system, wearing a data-model costume. Generalizing now spends real
prompt-tuning and schema effort on a second customer that does not yet exist. A
future reader seeing "configurable" in the vision but dental hardcoded in the code
would otherwise wonder why — this records that it was a deliberate scope choice, not
an oversight.

**Reconsider if:** a real second domain (non-dental) is onboarded — that is the
signal to generalize pillar count, scheduling, and the prompt structure.
