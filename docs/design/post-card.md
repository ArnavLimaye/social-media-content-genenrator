# Design lock: Post card, review flags, brand overlay

**Status:** accepted — human sign-off recorded on issue #7 (2026-07-20)
**Amended:** §2 inline editing, on issue #8 (2026-07-20) — see the note in that section
**Added to:** §2 calendar-mode rules, on issue #9 (2026-07-20)
**Added to:** §1 published read-only, §3 gate as built, on issue #10 (2026-07-20)
**Re-locked:** whole document re-derived from the prototype (2026-07-21) — see
"Re-lock" below for what changed
**Source:** operator prototype `Content Back-Office.dc.html`, "teal clinical" theme set
**Consumed by:** #8 (kanban), #9 (week-list, month-grid, editor drawer),
#10 (status lifecycle + approval gate)

## Re-lock (2026-07-21)

The implementation was rebuilt against the prototype. The rules below still
hold; these are the points where what shipped now differs from what this
document previously described.

- **Tinted surfaces did not exist.** `bg-accent/10` and friends emitted **no
  CSS at all** — Tailwind cannot compose an alpha over a bare `var()`, so every
  tinted chip, badge, and column well rendered transparent. The theme colors are
  now functions returning `color-mix(…, transparent)`. This was invisible to
  every test, because the class name was present in the markup either way.
- **A type scale replaced ad-hoc sizes.** The prototype works in half-pixel
  steps (10.5px column headers, 12.5px body, 14.5px card titles). These are
  named by role in `typeScale` (`text-body-lg`, `text-title`, `text-label-xs`).
- **The card shell has no padding.** Each band pads itself, so the footer rule
  runs edge to edge. §1's recipe is otherwise unchanged.
- **Card chrome is per-variant** (`kanban` / `week` / `drawer`): the week list's
  day gutter and the drawer's header bar already state the date and pillar, so
  the card drops them there rather than repeating them.
- **The topic is inline-editable** in the week list and drawer, which required
  adding it to `ScalarField`. It renders multiline (the prototype uses a
  single-line input, which scroll-clips a sentence-long topic).
- **Board chrome is one row**: identity, view switcher, and period stepper. The
  Board owns the anchored period; the calendar modes receive it.
- **The approval gate is a centred modal**, not an inline panel under the card.

Two places deliberately depart from the prototype, both because real data is
not prototype data:

- **Image-idea chips stack full-width** instead of wrapping inline. Generated
  briefs are a sentence or two, not the prototype's three words, and wrapped
  chips collapse into tall four-word ribbons.
- **Pillar chips truncate.** A pillar can be a whole sentence; unconstrained,
  it pushes past the card edge and crushes the layout beside it.

Onboarding keeps its submit button **enabled** when fields are missing, where
the prototype disables it — validation belongs to the server action, and a
client-side gate that refuses the click makes a real rejection unreachable.

This is the committed visual baseline. The **Post** card is rendered in three
places — kanban column, week-list row, and the editor drawer — so it is
specified once here. Anything not stated is the implementer's choice; anything
stated is settled, and changing it is a design decision, not a refactor.

Every value below is a token from `lib/theme/tokens.ts`. No literal colors,
radii, or fonts (ADR-0003, guard-enforced by `tests/no-hardcoded-tokens.spec.ts`).

## 1. Card shell

```
background   surface-raised      border  1px border      radius  --radius
shadow       --shadow-sm         overflow hidden
```

Three shell variants, and only three:

| Post state | Shell treatment |
|---|---|
| normal | the base shell above |
| `published` | background mixed 45% toward `surface` — visibly recessed, read-only |
| generation failed | **dashed** `danger` border at 45% mix, background 3% `danger` |

`published` is read-only: every editable field renders as static text.

## 2. Vertical order

The card is one column, `--space-3` between blocks, in this order. #8 and #9
must not reorder it — an operator scanning a kanban column and the same post in
the drawer should not have to re-find anything.

```
┌─ badge row ───────────────────────────────────────────┐
│  [▤ FORMAT]  [pillar]              ······  [STATUS]   │
├─ date line (kanban only) ─────────────────────────────┤
│  Wed · Jul 22                                         │
├─ topic + hook ────────────────────────────────────────┤
│  Why bleeding gums are not normal — 3 causes          │
│  "Most people ignore the first sign."                 │
├─ review flags (only when present) ────────────────────┤
│  [⚑ 2 flags ▼]   ← expands to claim → reason list     │
├─ slides ──────────────────────────────────────────────┤
│  1  Heading                                           │
│     Description                                       │
│     [CREATIVE chip] [PHOTO chip]                      │
│  2  …                                                 │
├─ caption ─────────────────────────────────────────────┤
│  CAPTION                                              │
│  Bleeding gums are not something to wait out…         │
├─ cta ─────────────────────────────────────────────────┤
│  CTA                                                  │
│  Book a checkup →                                     │
├─ hashtags ────────────────────────────────────────────┤
│  #dentalhealth #gumcare  (accent colored)             │
├─ footer (border-top) ─────────────────────────────────┤
│  status note            ······   [Regen] [Approve]    │
└───────────────────────────────────────────────────────┘
```

**Badge row.** Format badge is an outlined pill (`border`, `text-muted`,
uppercase) with a glyph: `▤` carousel, `▶` reel, `◫` infographic. The pillar
badge is a filled pill at 10% `accent` on `accent` text — this is the element
that visibly carries the per-Client brand (see §4). Status badge sits right,
built from one shared recipe: `color-mix` 12% background, 25% border, solid
text, all from a single status color —

| status | token | label |
|---|---|---|
| draft | `text-muted` | Draft |
| approved | `accent` | Approved |
| published | `success` | ✓ Published |
| failed | `danger` | Failed |

**Section labels** (`CAPTION`, `CTA`) are 9.5px/800 uppercase, `.09em` tracking,
`text-muted`.

**Slides** are a `16px 1fr` grid: index number in `text-muted`, then heading
(600) / description (`text-muted`) / image-idea chips. Each slide block sits on
`surface` at `--radius-sm`, so slides read as inset within the raised card.

**Image-idea chips** encode `type` (see CONTEXT.md — `creative` | `photo`)
by *color*, not by an icon: `creative` is accent-outlined at 8% accent fill;
`photo` is neutral `border` on `surface`. The kind is repeated as uppercase
text inside the chip, so the distinction is never color-only.

**Inline editing** (kanban, week-list, and drawer). `hook`, `caption`, `cta`,
`hashtags`, and each slide's `heading` / `description` are borderless fields
that reveal a `border` outline on hover and an `accent` outline with a `surface`
fill on focus. They must occupy the same box as the static text — no layout
shift between reading and editing. Negative `margin-left` offsets the field
padding so text stays optically aligned. An edit commits on blur; an unchanged
field commits nothing.

Free-text fields that routinely run past one line — `caption` and each slide's
`description` — are **auto-sizing textareas** that grow to fit their content, so
no copy is visually truncated. Single-line fields (`hook`, `cta`, `hashtags`,
slide `heading`) stay inputs. `topic` is not editable on the card; it is the
post's identity in a kanban column.

> **Amended 2026-07-20 (issue #8).** This section originally read "week-list and
> drawer; not kanban" and named `topic`/`hook`/`caption`. Issue #8's acceptance
> criteria put inline editing on the Board, which won; the editable set is the
> one listed above. The auto-sizing textarea rule was added in the same slice,
> after single-line inputs were found to clip multi-paragraph captions. #9
> inherits this amended rule, not the original.

**Footer** carries a status note left, actions right:

| status | note | actions |
|---|---|---|
| draft, no flags | Ready for review | Approve |
| draft, flags unacknowledged | Review flags before approving | Approve… |
| draft, flags acknowledged | Flags reviewed | Approve |
| approved | Queued — publishes {date} | Publish |
| published | Published {date} · read-only | — |
| failed | Planner outline saved · copy failed | ↻ Regenerate |

`published` notes render in `success` at weight 600; all others `text-muted`.

### Added 2026-07-20 (issue #9) — where the card appears, and where it does not

The card renders in three places, as stated above: kanban column, week-list row,
editor drawer. Two clarifications that #9 settled by building it:

- **The date line stays kanban-only**, as the diagram says. In the calendar
  modes the card's position *is* its date, and rendering the line as well put
  "Wed · Jul 22" twice on one screen. `PostCard` takes `showDateLine`, default
  on; week-list and drawer pass it off.
- **The month grid does not render the card at all.** A calendar square cannot
  hold a caption and five slides, so a cell carries a compact summary — format
  badge, topic (2-line clamp), status badge, and a mute `⚑ n` flag marker whose
  accessible name spells out the count. The summary is display-only; clicking it
  opens the drawer, which is where the editable card lives. Card and summary
  share one badge vocabulary (`post-badges.tsx`) so the two can never disagree
  about what a status looks like.

**Generation-failed is derived, not stored.** The `failed` row in the status and
footer tables above has no matching value in the database: when the copywriter
call fails, the orchestrator saves the planner's outline, leaves every copy field
null, and keeps `status = "draft"`. So the shell variant, the status badge, and
the footer note all key off `postState()` (`lib/post-state.ts`), never off
`post.status` directly.

## 3. Review-flag treatment

A **Review Flag** is a spotlight, not a filter (CONTEXT.md) — the visual must
draw the eye without reading as an error. It therefore uses `warning`
throughout, never `danger`; `danger` is reserved for actual failure.

Collapsed, it is a button: `⚑ {n} flags ▼` in `warning` on a 10% `warning`
fill with a 35% `warning` border. Expanded, it reveals a stacked list on a 6%
`warning` panel, one line per flag:

> **"Whitening is completely safe for everyone"** → absolute safety claim, needs clinician review

The claim is quoted and weighted 600; the reason follows an arrow in
`text-muted`. Both are always shown — a claim without its reason gives the
operator nothing to act on.

**Acknowledgment gate.** A Post with flags cannot go draft → approved without
one explicit acknowledgment (`flagsAcknowledgedAt`). This is the v1
medical-accuracy safeguard, so the UI must not let it be clicked past
accidentally:

- the approve button reads **Approve…** (ellipsis signals a further step)
- it opens a confirm dialog listing every flag
- confirm is **disabled** until an acknowledgment checkbox is ticked
- afterward the badge reads `⚑ 2 reviewed` and the footer `Flags reviewed`

Acknowledging records that a human looked. It does not mark the claim true, and
no copy in the UI should imply that it does.

### Added 2026-07-20 (issue #10) — the gate as built

The spec above was implemented as written. Four things it did not settle, which
building it forced:

- **The confirmation renders inline beneath the card, not as an overlay**, and
  deliberately carries no `aria-modal`. The flags belong to *this* Post, and in
  a kanban column the surrounding card is the context that makes them legible.
  It does not trap focus or inert the page, so claiming `aria-modal` would
  misdescribe it — and in the month-grid drawer it would nest a modal inside a
  modal.
- **`published` recessing uses `color-mix` over two existing tokens**
  (`surface` 45% into `surface-raised`) rather than a new `surface-sunk` token —
  the same technique the review-flag border already uses, so it still moves with
  the theme (ADR-0003).
- **A published Post renders its copy as plain text, not disabled inputs.** The
  record stays fully readable, and there is no affordance suggesting an edit
  that would be refused. The data layer refuses it too (`lib/posts.ts`), so
  read-only is a guarantee rather than a UI convention.
- **The footer's "draft, flags acknowledged → Flags reviewed" row is
  unreachable in practice.** Acknowledging and approving are one action, so a
  draft never carries `flagsAcknowledgedAt`; and nothing walks a Post back. The
  state is implemented and tested anyway, because the badge's `⚑ n reviewed`
  form *is* reachable — it is what an approved or published Post shows.

**Approvability is derived, never assumed.** `canApprove()`
(`lib/post-status.ts`) decides whether the Approve action renders at all, and
the same function guards the write, so the footer and the database cannot
disagree about what is legal. A generation-failed Post is not approvable: its
route out is regeneration (#11), not queuing an empty slot.

## 4. Per-Client brand overlay

`Client.colors` and `Client.logoUrl` express with **zero component changes** —
this is the constraint that makes the treatment worth locking.

**Accent.** The first color in `Client.colors` overrides `--color-accent` for
that Client's subtree, via `<BrandOverlay>` (`app/brand-overlay.tsx`). Every
`accent`-derived class then rebrands automatically: pillar badges, image-idea
chips, hashtags, focus rings, the approved status badge, day labels.

Only the accent is overridable, deliberately. A Client cannot repaint
`surface`, `text`, or `border`, because bad brand data would then destroy
contrast and make the app unreadable. Because an arbitrary clinic color lands
on `--color-accent`, anything painting an accent *fill* must take its foreground
from `--color-on-accent` rather than assuming dark-on-light.

A malformed or missing `colors` value yields no override and the theme's own
accent stands (`tests/brand-overlay.spec.tsx`).

**Logo.** `logoUrl` renders as a `--radius-sm` tile, `contain`-fit on `surface`
so non-square and transparent logos are not distorted or lost. With no logo,
the fallback is the clinic's initials on an `accent` fill using
`--color-on-accent` — which means the fallback rebrands too.

## 5. Light and dark

Both modes render from the **same token names**; only values differ, so no
component branches on mode. Two things do not simply invert, and are fixed
in the token file:

- **Shadows.** Light tints shadow with `--color-text`; dark uses true black,
  because tinting with a near-white text color would lighten rather than deepen.
- **Surface pairing.** `surface` is the page, `surface-raised` is cards. In dark
  mode raised is *lighter* than the page; in light mode it is *whiter*. Cards
  must always use `surface-raised` and never `surface`, or they vanish in one
  of the two modes.

## Closed — human sign-off (issue #7, 2026-07-20)

- [x] "teal clinical" is the committed set; `warm` and `mono` from the
      prototype are **not** ported (decision recorded in this session)
- [x] The flag acknowledgment copy does not overstate what acking means
- [x] The published/read-only recessed treatment is legible enough in dark
