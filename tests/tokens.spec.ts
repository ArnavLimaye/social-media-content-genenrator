import { describe, it, expect } from "vitest";
import {
  lightTokens,
  darkTokens,
  tailwindTheme,
  tokenCss,
  CANONICAL_TOKEN_NAMES,
} from "@/lib/theme/tokens";
import tailwindConfig from "@/tailwind.config";

// Behavior B — the theme is a single source of truth.
//
// One module (lib/theme/tokens.ts) defines every color, radius, and font as
// named CSS custom properties for both light and dark, and the Tailwind config
// maps its theme from those same names. Editing that one file must restyle the
// whole app, so the test pins both halves: the token names exist in both modes,
// Tailwind's theme references the CSS vars (not hardcoded values), and the
// generated CSS carries the values from the same module.

// Behavior 1 (issue #7 — design lock) — the token VALUES are finalized.
//
// The mechanism landed in #2; this pins the concrete palette, radii, typography
// and spacing approved from the operator's prototype ("teal clinical" set), so
// the rich Board work in #8/#9 builds against a settled baseline. These are
// deliberately exact-value assertions: the point of a design lock is that a
// value change is a visible, reviewed diff, not an accident.

// The Tailwind colors are FUNCTIONS of the opacity modifier (see tokens.ts), so
// they cannot be compared as strings or walked with JSON.stringify — which
// drops functions silently and would make a reachability check pass vacuously.
// These two helpers resolve them at full opacity first.
const color = (name: keyof typeof tailwindTheme.colors) => tailwindTheme.colors[name]({});

function serializeTheme(): string {
  const resolved = Object.fromEntries(
    Object.keys(tailwindTheme.colors).map((k) => [
      k,
      color(k as keyof typeof tailwindTheme.colors),
    ]),
  );
  return JSON.stringify({ ...tailwindTheme, colors: resolved });
}

describe("theme tokens: the locked design values", () => {
  it("commits the approved light palette", () => {
    expect(lightTokens["--color-primary"]).toBe("#0f766e");
    expect(lightTokens["--color-accent"]).toBe("#0e7490");
    expect(lightTokens["--color-surface"]).toBe("#f0f5f5");
    expect(lightTokens["--color-surface-raised"]).toBe("#ffffff");
    expect(lightTokens["--color-text"]).toBe("#13292d");
    expect(lightTokens["--color-text-muted"]).toBe("#5d7578");
    expect(lightTokens["--color-border"]).toBe("#d8e2e2");
  });

  it("commits the approved dark palette", () => {
    expect(darkTokens["--color-primary"]).toBe("#2fbfae");
    expect(darkTokens["--color-accent"]).toBe("#26b6cf");
    expect(darkTokens["--color-surface"]).toBe("#0e1719");
    expect(darkTokens["--color-surface-raised"]).toBe("#152225");
    expect(darkTokens["--color-text"]).toBe("#e4eeee");
    expect(darkTokens["--color-text-muted"]).toBe("#93a8aa");
    expect(darkTokens["--color-border"]).toBe("#26383b");
  });

  it("carries a foreground token for every filled background, so text on a fill is never guesswork", () => {
    for (const tokens of [lightTokens, darkTokens]) {
      expect(tokens["--color-on-primary"]).toBeTruthy();
      expect(tokens["--color-on-accent"]).toBeTruthy();
      // a fill and its foreground must actually differ
      expect(tokens["--color-on-primary"]).not.toBe(tokens["--color-primary"]);
      expect(tokens["--color-on-accent"]).not.toBe(tokens["--color-accent"]);
    }
  });

  it("carries the status colors the Post card needs for flags and lifecycle", () => {
    for (const tokens of [lightTokens, darkTokens]) {
      expect(tokens["--color-success"]).toBeTruthy();
      expect(tokens["--color-warning"]).toBeTruthy();
      expect(tokens["--color-danger"]).toBeTruthy();
    }
  });

  it("commits the radius and spacing scale", () => {
    expect(lightTokens["--radius"]).toBe("8px");
    expect(lightTokens["--radius-sm"]).toBe("calc(var(--radius) - 3px)");
    expect(lightTokens["--radius-pill"]).toBe("999px");
    expect(lightTokens["--space-1"]).toBe("4px");
    expect(lightTokens["--space-7"]).toBe("48px");
  });

  it("no longer carries --color-muted, which ambiguously meant both border and muted text", () => {
    expect(lightTokens).not.toHaveProperty("--color-muted");
    expect(darkTokens).not.toHaveProperty("--color-muted");
  });
});

describe("theme tokens: single source of truth", () => {
  it("defines the canonical token names in both light and dark", () => {
    for (const name of CANONICAL_TOKEN_NAMES) {
      expect(lightTokens).toHaveProperty(name);
      expect(darkTokens).toHaveProperty(name);
    }
    // the PRD-named tokens specifically
    expect(CANONICAL_TOKEN_NAMES).toEqual(
      expect.arrayContaining([
        "--color-primary",
        "--color-accent",
        "--color-surface",
        "--color-text",
        "--radius",
        "--font-sans",
      ]),
    );
    // spacing is part of the token set too
    expect(Object.keys(lightTokens).some((k) => k.startsWith("--space-"))).toBe(true);
  });

  it("drives light and dark from the SAME token names", () => {
    expect(Object.keys(lightTokens).sort()).toEqual(Object.keys(darkTokens).sort());
  });

  it("maps Tailwind theme to CSS vars, never hardcoded values", () => {
    expect(color("primary")).toBe("var(--color-primary)");
    expect(color("accent")).toBe("var(--color-accent)");
    expect(color("surface")).toBe("var(--color-surface)");
    expect(color("text")).toBe("var(--color-text)");
    expect(tailwindTheme.fontFamily.sans).toBe("var(--font-sans)");
    expect(tailwindTheme.borderRadius.DEFAULT).toBe("var(--radius)");

    // no Tailwind theme value smuggles in a raw hex color
    expect(serializeTheme()).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it("exposes every locked token to Tailwind as a var, so components never need arbitrary values", () => {
    // the split that replaced the ambiguous `muted`
    expect(color("border")).toBe("var(--color-border)");
    // keyed `muted` so call sites read `text-muted` rather than `text-text-muted`
    expect(color("muted")).toBe("var(--color-text-muted)");
    expect(color("surface-raised")).toBe("var(--color-surface-raised)");
    // foregrounds for filled backgrounds
    expect(color("on-primary")).toBe("var(--color-on-primary)");
    expect(color("on-accent")).toBe("var(--color-on-accent)");
    // status colors the Post card's flag + lifecycle treatment needs
    expect(color("warning")).toBe("var(--color-warning)");
    // geometry
    expect(tailwindTheme.borderRadius.sm).toBe("var(--radius-sm)");
    expect(tailwindTheme.borderRadius.pill).toBe("var(--radius-pill)");
    expect(tailwindTheme.spacing[7]).toBe("var(--space-7)");
    expect(tailwindTheme.boxShadow.sm).toBe("var(--shadow-sm)");
  });

  it("maps a Tailwind name for every canonical token, so none is unreachable from a class", () => {
    const exposed = serializeTheme();
    for (const name of CANONICAL_TOKEN_NAMES) {
      expect(exposed, `${name} is not reachable from any Tailwind utility`).toContain(`var(${name})`);
    }
  });

  // The opacity modifier is why the colors are functions rather than plain
  // strings. A bare `var(--color-accent)` carries no alpha, so Tailwind emits
  // NO RULE AT ALL for `bg-accent/10` — the tinted chips, badges, and column
  // surfaces the design is built from would silently render transparent, and no
  // component test would notice because the class name is still in the markup.
  //
  // `color-mix(..., transparent)` is also the exact construction the design
  // uses for every tint, so the two resolve to the same color — including when
  // the brand overlay swaps `--color-accent` for a clinic's own hex.
  it("composes an alpha over a token, so tinted surfaces actually emit CSS", () => {
    expect(tailwindTheme.colors.accent({ opacityValue: "0.1" })).toBe(
      "color-mix(in srgb, var(--color-accent) 10%, transparent)",
    );
    expect(tailwindTheme.colors.warning({ opacityValue: "0.35" })).toBe(
      "color-mix(in srgb, var(--color-warning) 35%, transparent)",
    );
    // binary floating point makes 0.03 * 100 = 3.0000000000000004
    expect(tailwindTheme.colors.text({ opacityValue: "0.03" })).toBe(
      "color-mix(in srgb, var(--color-text) 3%, transparent)",
    );
  });

  // Tailwind does not always hand in a NUMBER: for a modifier-less `text-muted`
  // it passes the literal string `var(--tw-text-opacity)`, which is unusable
  // inside color-mix. Falling back to the opaque token is what a utility with no
  // modifier means anyway.
  it("falls back to the opaque token when the alpha is not a number", () => {
    expect(tailwindTheme.colors.muted({ opacityValue: "var(--tw-text-opacity)" })).toBe(
      "var(--color-text-muted)",
    );
    expect(tailwindTheme.colors.muted({})).toBe("var(--color-text-muted)");
  });

  it("is the source the Tailwind config actually consumes", () => {
    // the config must wire its extend from the token module
    expect(tailwindConfig.theme?.extend?.colors?.primary).toBe(tailwindTheme.colors.primary);
    expect(tailwindConfig.theme?.extend?.fontFamily?.sans).toBe(tailwindTheme.fontFamily.sans);
    expect(tailwindConfig.theme?.extend?.borderRadius?.DEFAULT).toBe(tailwindTheme.borderRadius.DEFAULT);
  });

  it("generates CSS custom properties for :root (light), [data-theme=dark], and prefers-color-scheme from the same values", () => {
    const css = tokenCss();

    // light values on :root
    expect(css).toContain(`:root`);
    expect(css).toContain(`${lightTokens["--color-primary"]}`);

    // dark driven by both an explicit override AND the system preference
    expect(css).toContain(`[data-theme="dark"]`);
    expect(css).toContain(`prefers-color-scheme: dark`);
    expect(css).toContain(`${darkTokens["--color-primary"]}`);

    // the dark primary differs from light (otherwise dark mode is a no-op)
    expect(darkTokens["--color-primary"]).not.toBe(lightTokens["--color-primary"]);
  });
});