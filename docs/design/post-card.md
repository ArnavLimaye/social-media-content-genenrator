# Design lock: Post card, review flags, brand overlay

**Status:** accepted — human sign-off recorded on issue #7 (2026-07-20)
**Amended:** §2 inline editing, on issue #8 (2026-07-20) — see the note in that section
**Source:** operator prototype `Content Back-Office.dc.html`, "teal clinical" theme set
**Consumed by:** #8 (kanban / month-grid / week-list), #9 (editor drawer)

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
