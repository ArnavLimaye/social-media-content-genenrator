# Theme tokens as the single source of styling

**Status:** accepted

All visual styling — colors, radii, fonts, spacing — flows from one module,
`lib/theme/tokens.ts`. No component hardcodes a color, radius, or font; editing
that one file restyles the whole app.

The module defines every token as a named CSS custom property, for light and
dark, under the **same names** (only the values differ):

- `lightTokens` / `darkTokens` — the vocabulary locked by issue #7:
  `--color-primary` / `--color-on-primary`, `--color-accent` /
  `--color-on-accent`, `--color-surface` / `--color-surface-raised`,
  `--color-text` / `--color-text-muted`, `--color-border`, `--color-success` /
  `--color-warning` / `--color-danger`, `--radius` / `--radius-sm` /
  `--radius-pill`, `--font-sans`, `--space-1…7`, `--shadow-sm` / `--shadow-md`.
  Two conventions are load-bearing:
  - **Every filled background has a paired foreground** (`--color-on-accent`).
    A component painting a fill never guesses whether light or dark text reads
    on it — which matters because the brand overlay can put an arbitrary clinic
    color on `--color-accent`.
  - **Borders and muted text are separate tokens.** These were one
    `--color-muted` before #7, which meant a single value could not be tuned
    for both jobs. `tests/no-hardcoded-tokens.spec.ts` now also guards the
    *closed vocabulary*: a class naming a token that does not exist (`border-muted`)
    emits no CSS at all and passes every other check, so it needs its own guard.
- `tailwindTheme` — maps Tailwind names to the CSS var *names*
  (`colors.primary = "var(--color-primary)"`, `fontFamily.sans =
  "var(--font-sans)"`, `borderRadius.DEFAULT = "var(--radius)"`). Values stay in
  the CSS vars, so the token file remains the single source of the actual
  colors — Tailwind never carries a hex value.
- `tokenCss()` — generates the CSS custom-property declarations for `:root`
  (light), `@media (prefers-color-scheme: dark)`, and `[data-theme="dark"]` /
  `[data-theme="light"]` overrides (which win on source order). Injected into
  the document by `app/theme-style.tsx`.

Light/dark therefore render from the **same token names**: a component's
`bg-surface text-text font-sans` classes do not change between modes; only the
underlying var values flip. A `[data-theme]` override on `:root` (set by the
theme toggle and a no-FOUC script in `app/layout.tsx`) takes precedence over the
system preference.

A guard test (`tests/no-hardcoded-tokens.spec.ts`) fails if any file under
`app/` contains a literal hex/rgb/hsl color, an arbitrary color utility
(`bg-[#fff]`), an arbitrary radius (`rounded-[8px]`), or an inline font-family.
The test has a teeth-check so it cannot pass vacuously. `lib/theme/tokens.ts`
is the one place hex values are allowed.

**Why a TS module generating CSS, not hand-written `globals.css`:** so the
values have a single, testable source and the Tailwind theme is provably derived
from the same names (asserted by `tests/tokens.spec.ts`). The cost is a
build/runtime `<style>` injection rather than a static CSS file — acceptable for
a local single-operator app.

**The per-Client brand overlay** (added by #7) confirmed the prediction below: it
is purely a var override. `<BrandOverlay>` (`app/brand-overlay.tsx`) scopes
`--color-accent` to a **Client**'s first brand color over its subtree, and no
child component takes a color prop or changed at all. Deliberately, *only* the
accent is overridable — letting a Client repaint `--color-surface` or
`--color-text` would let bad brand data destroy contrast and make the app
unreadable. Parsing and that policy live in `lib/theme/brand.ts`; a malformed
value yields no override rather than an invalid declaration.

**Reconsider if:** the brand overlay ever needs to vary a token *other* than the
accent, or a second theme set (the prototype's `warm` / `mono`) is actually
wanted. Only `teal` was committed by #7. Adding sets means a
`[data-theme-set]` dimension crossed with light/dark — extend the token module
rather than hardcoding in components.

**See also:** `docs/design/post-card.md` — the #7 design lock for the Post card,
review-flag treatment, and brand overlay, which #8/#9 implement against.