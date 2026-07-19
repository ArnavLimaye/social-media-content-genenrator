# Theme tokens as the single source of styling

**Status:** accepted

All visual styling — colors, radii, fonts, spacing — flows from one module,
`lib/theme/tokens.ts`. No component hardcodes a color, radius, or font; editing
that one file restyles the whole app.

The module defines every token as a named CSS custom property, for light and
dark, under the **same names** (only the values differ):

- `lightTokens` / `darkTokens` — `{ "--color-primary", "--color-accent",
  "--color-surface", "--color-text", "--color-muted", "--radius", "--font-sans",
  "--space-1/2/4", … }`.
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

**Reconsider if:** a per-**Client** brand overlay (accent + logo from
`Client.colors`/`logoUrl`) needs something a CSS-var swap can't express. The
overlay is already just var overrides, so this is unlikely; if it happens,
extend the token module rather than hardcoding in components.