# Dental Content Back-Office — starter files

Drop these into your Next.js repo, then plan/build the rest in Claude Code
(`grill-me` → `to-prd` → `to-issues`). These are the pieces the skills won't
write for you: the data model, the Ollama wrapper, and the two agent prompts.

## Files

| File | What it is |
|---|---|
| `prisma/schema.prisma` | Client / Plan / Post models, incl. per-agent token-count fields on Post. |
| `lib/ollama.ts` | OpenAI-compatible Ollama Cloud caller. Per-call `model` + `max_tokens`; returns token counts. |
| `lib/prompts/planner.ts` | Planner agent: clinic + pillars + recent topics → a week of 3 topics as strict JSON. |
| `lib/prompts/copywriter.ts` | Copywriter agent: one topic + brand voice → full post copy as strict JSON, with `reviewFlags`. |

## How the generate endpoint uses them (the one non-CRUD piece)

Pseudo-flow for `POST /api/generate` (build this during the issues phase):

1. Load the Client and its last ~20 post topics (for `recentTopics`).
2. Call the **planner** once — `callOllama` with the planner model, a ~800 `max_tokens` cap, `PLANNER_SYSTEM` + `buildPlannerUser(...)`. Parse JSON → 3 planned posts. Log `promptTokens`/`outputTokens`.
3. For each planned post, call the **copywriter** — copywriter model, ~1200 cap, `COPYWRITER_SYSTEM` + `buildCopywriterUser(...)`. Parse JSON. Log its token counts.
4. Write 3 `Post` rows (status `draft`), storing `hook`/`caption`/`cta`, `slides`,
   `hashtags`, `reviewFlags`, and all four token counts. No `copy` column — see
   ADR-0001 (post content is a document).

## Two things to remember

- **Token limits:** `max_tokens` per call is your only *hard* lever (Ollama Cloud
  bills GPU-time, not tokens). For a hard *monthly* cap, sum the logged token
  fields for the client before generating and refuse if over budget — that's app
  logic, decided during grilling.
- **Model tags:** the prompts don't hardcode a model; the endpoint passes it.
  Confirm current tags at ollama.com before wiring — names change.

## Confirm during `grill-me`

- Does JSON-only output hold up on your chosen models, or do you need a repair/retry step?
- Is `reviewFlags` a sufficient medical safeguard for v1, or does any flagged post get blocked from `approved` until cleared?
- Plan created up front or lazily on first generation?
