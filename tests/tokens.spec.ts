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
    expect(tailwindTheme.colors.primary).toBe("var(--color-primary)");
    expect(tailwindTheme.colors.accent).toBe("var(--color-accent)");
    expect(tailwindTheme.colors.surface).toBe("var(--color-surface)");
    expect(tailwindTheme.colors.text).toBe("var(--color-text)");
    expect(tailwindTheme.fontFamily.sans).toBe("var(--font-sans)");
    expect(tailwindTheme.borderRadius.DEFAULT).toBe("var(--radius)");

    // no Tailwind theme value smuggles in a raw hex color
    const allValues = JSON.stringify(tailwindTheme);
    expect(allValues).not.toMatch(/#[0-9a-fA-F]{3,8}/);
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