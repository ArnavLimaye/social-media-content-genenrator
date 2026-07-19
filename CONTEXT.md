# Dental Content Back-Office

A local, single-operator "digital back office" for a content marketer who manages
AI-generated social media content for dental clinics. Onboard a clinic, generate
draft posts per week, review/edit them, and track what's been published.

## Language

**Client**:
A dental clinic the operator manages content for. Carries brand identity (name,
location, audience, brand voice, colors, logo) and its three content pillars.
_Avoid_: Customer, tenant, account.

**Operator**:
The single human using the app locally (the content marketer). Not modelled as a
user — there is no auth or multi-tenancy in the MVP.
_Avoid_: User, admin.

**Pillar**:
A recurring weekly content theme for a **Client**, fixed at three: Monday,
Wednesday, Friday (`pillarMon` / `pillarWed` / `pillarFri`). Dental MVP treats
the three-pillar / three-day shape as a hardcoded constant.
_Avoid_: Theme, category, topic (a **Topic** is narrower — see below).

**Domain Profile**:
The small, injected slice of prompt text that makes the pipeline dental-specific
(clinic-type framing + medical guardrail sentence). Kept as a seam so the domain
could be swapped later; everything else (pillar count, day mapping, schema) stays
hardcoded to dental for the MVP.
_Avoid_: Vertical, niche.

**Topic**:
A specific, concrete subject line for one post ("Why bleeding gums are not normal
— 3 causes"), produced by the Planner. Narrower than a **Pillar**.

**Post**:
One unit of content for a **Client**, serving one **Pillar**. Holds the planner's
`topic`/`objective`/`format`, the copywriter's output, and a `scheduledDate`
(derived from the plan's week + the planner's Mon/Wed/Fri day). Moves through a
status lifecycle (draft → approved → published). The MVP deliverable is text copy,
not a rendered image.

**Board**:
The third screen: one view over a **Client**'s **Posts** with switchable modes — a
kanban grouped by status, and a calendar (month-grid / week-list toggle) driven by
`scheduledDate`. Inline editing lives in kanban and week-list; month-grid cells
open a post editor on click.

**Review Flag**:
A copywriter-generated `{ claim, reason }` pair marking content a human should
verify (medical claims, statistics, outcome promises). A spotlight, not a filter —
it speeds review but certifies nothing. A **Post** with any Review Flags cannot
advance draft → approved without a one-click operator acknowledgment (logged via
`flagsAcknowledgedAt`); this is the v1 medical-accuracy safeguard, in lieu of a
fact-check agent. The board shows each flag's claim and reason inline.

**Slide**:
One text block within a **Post**'s carousel/reel, carrying a `heading`, a
`description`, and 2–3 **Image Ideas**. Stored as a document (JSON) on the Post,
not a table (see ADR-0001). For a reel, slides are script beats.

**Plan**:
The atomic result of one "Generate this week" click: one Plan (`period="week"`)
plus three draft **Posts**, created together in a single transaction. Not an empty
container the operator pre-creates. A client is blocked from a second plan for the
same week; an explicit **Regenerate** replaces that week's *draft* posts only
(never approved/published ones). `period="month"` exists in the field but is v2.
_Avoid_: Batch, campaign, schedule.

**Image Idea**:
A copywriter-generated text suggestion for one visual asset on a **Slide**, tagged
with a `type` (`creative` | `photo`). The operator pastes it into their own AI
image tool. Note: `infographic` is a post-level **format**, not an image type.
The app never renders or calls an image API in the MVP.

## Relationships

- The **Operator** manages many **Clients** (locally, no auth).
- A **Client** has exactly three **Pillars** (Mon/Wed/Fri).
- The **Domain Profile** is injected into agent prompts; it is not per-Client data.

## Stack (walking skeleton)

Local single-operator app, no auth. The stack and its load-bearing decisions
live in the ADRs; this is the quick reference.

- **Next.js 16** (App Router, Turbopack) + **React 18** + **Tailwind 3**.
- **Prisma 7** + **`@prisma/adapter-better-sqlite3`** over SQLite. Connection URL
  in `prisma.config.ts`; `PrismaClient` from `@/generated/prisma/client`
  (`generated/` is gitignored). See ADR-0004.
- **Node 22** — pinned via `.nvmrc`. Run `nvm use 22` before any
  `npm` / `next` / `prisma` command (Prisma 7 needs `≥20.19`; see ADR-0004).
- **Theming** — one module (`lib/theme/tokens.ts`) drives all colors/radii/fonts
  for light + dark; no component hardcodes a value (guard-enforced). See
  ADR-0003.
- **Tests** — Vitest + happy-dom + Testing Library. The suite runs against an
  isolated `test.db` (set in `vitest.global-setup.ts`, which also runs
  `prisma migrate deploy`), never the operator's `dev.db`.

## Flagged ambiguities

- "Domain configurable" (vision) vs. dental hardcoded everywhere (code) — resolved:
  MVP is hardcoded dental with ONE seam (the **Domain Profile** text). Variable
  pillar count / arbitrary schedules are deferred until a real second domain exists.
- "Multi-tenant" (used for the theming ask) — resolved: it is NOT multi-tenancy. The
  design-token theme file and per-**Client** brand overlay (accent + logo from
  `Client.colors`/`logoUrl`) are presentation-only over one shared local database.
  Multi-tenancy (auth, tenant data isolation) stays out of scope. Use "theming" /
  "brand overlay" / "white-labeling the UI", never "multi-tenant".
