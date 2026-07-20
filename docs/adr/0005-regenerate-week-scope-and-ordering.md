# Regenerate: draft-only scope, and generate-before-delete ordering

**Status:** accepted

A **Client** may hold only one **Plan** per week, and the way to redo a week is
an explicit **Regenerate** that replaces that week's *draft* **Posts** — never
its approved or published ones (issue #11).

## One Plan per week

`Plan.weekStart` stores the week's Monday **at UTC midnight**, with a
`@@unique([clientId, period, weekStart])` index. `weekStart` is the *identity*
of the week; the pre-existing `label` ("Week of 2026-07-20") remains a display
string.

Two decisions inside that:

- **The time component is stripped.** `weekStartFor` returns 09:00Z, which is
  the right default for *scheduling* a post's time of day but wrong as an
  identity — two callers generating on the same Monday at different hours must
  land on one week, not two. `weekKey()` in `lib/generate-week.ts` does the
  normalisation, and is the reason the unique index bites.
- **The constraint lives in the database, not only in the orchestrator.** Two
  "Week of ..." columns for the same dates is a data-model error, so a caller
  reaching past `generateWeek` is refused too. `weekStart` is nullable because
  `period="month"` (v2) has no week; SQLite treats NULLs as distinct under a
  unique index, so month plans never collide with one another.

The migration that added this had to resolve a real duplicate already sitting in
the operator's `dev.db` — two identical week Plans 39 seconds apart, exactly the
double-click this constraint now prevents. It keeps the oldest Plan per
(client, period, week) and deletes newer ones with their Posts.

## Regenerate replaces drafts, and refills only their days

Approved copy is committed and published copy is already public. So regeneration
discards only `status="draft"` Posts, and the planner is asked for **only the
days those drafts occupied** — a day held by an approved or published Post is
not planned at all, which is what makes it impossible to produce a second post
for a day that is already spoken for.

That is why `buildPlannerSystem` / `buildPlannerUser` / `validatePlannedPosts`
take a `days` argument instead of hardcoding three. ADR-0002 still holds: the
Mon/Wed/Fri *shape* is a hardcoded constant, and `days` only ever narrows which
of those three a given call plans — it never adds a fourth.

Regeneration reuses the existing Plan rather than creating a new one. Creating a
second Plan would reintroduce the duplicate week this ADR's first half exists to
prevent.

## Generate before delete — deliberately not what the issue said

Issue #11 describes deleting the drafts *first*, so their topics fall out of the
recent-topics avoid-list (#5) and do not constrain the retry. Its own acceptance
criteria also require that a failed regeneration never leaves a week with its
drafts deleted and no replacements. **Those two cannot both hold in that
order**: the model call sits between the delete and the insert, and it can fail.

So the order is inverted. The doomed drafts are *excluded* from the avoid-list
while they still exist (`runAgents({ excludePostIds })`), all network work
happens, and the delete + insert land together in one transaction at the end.
Both criteria hold: discarded ideas do not steer the retry, and a failed
regeneration is a complete no-op.

The alternative — wrapping delete, generate, and insert in one interactive
transaction — was rejected: it would hold a SQLite write lock across minutes of
model latency, and Prisma's interactive transactions time out well before a
three-post generation finishes.

`tests/regenerate-week.spec.ts` pins this. Both halves were verified by
mutation: restoring the delete-first ordering fails the failure-safety test, and
dropping `excludePostIds` fails the avoid-list test.

**Reconsider if:** per-post regeneration is ever wanted (explicitly out of scope
for the MVP — the generation-failed marker on the Post card is an `aria-hidden`
hint pointing at the week-level action, not a control), or if generation moves
to a job queue, where a crash between the network call and the transaction
becomes a real failure mode rather than a process-local one.
