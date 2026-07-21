import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { tailwindTheme, typeScale } from "@/lib/theme/tokens";

// Behavior D — a guard: no component hardcodes a color, radius, or font.
//
// The theme file (lib/theme/tokens.ts) is the single source. Every component
// must style itself through token-derived utility classes, so that editing the
// one token file restyles the whole app. This test scans app/** for escapes:
// literal hex/rgb/hsl colors, arbitrary color brackets (bg-[#fff]), inline
// font-family / color styles, and arbitrary radius (rounded-[8px]).
//
// lib/theme/tokens.ts is the one place hex values ARE allowed, so it is out of
// scope (it lives under lib/, not app/). theme-style.tsx injects tokenCss()
// output and contains no literals of its own.

const APP_DIR = path.resolve(__dirname, "..", "app");

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (/\.(tsx|ts)$/.test(entry)) acc.push(full);
  }
  return acc;
}

// The detector, exported as a function so the test can prove it has teeth
// (a guard that matches nothing would pass vacuously).
export function findHardcodedTokens(src: string): string[] {
  const hits: string[] = [];
  const patterns: Array<[RegExp, string]> = [
    [/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g, "hex color"],
    [/\b(?:rgb|hsl)a?\s*\(/g, "rgb/hsl color"],
    [/\b(?:bg|text|border|ring|from|to|fill|stroke)-\[#(?:[0-9a-fA-F]{3,8})\]/g, "arbitrary color utility"],
    [/rounded-\[[^\]]+\]/g, "arbitrary radius"],
    [/fontFamily\s*:/g, "inline font-family"],
    [/font-\[[^\]]+\]/g, "arbitrary font utility"],
  ];
  for (const [re, label] of patterns) {
    for (const m of src.matchAll(re)) hits.push(`${label}: "${m[0]}"`);
  }
  return hits;
}

// A second guard, for the opposite failure: a class that names a token which
// does not exist. `border-muted` used to resolve; after the #7 design lock
// split `--color-muted` into `--color-border` and `--color-text-muted`, it
// resolves to nothing and Tailwind emits no rule — the border silently
// vanishes. No hardcoded value is present, so the guard above stays green and
// the existing component tests still pass, because Testing Library does not
// care about class names. Only a closed-vocabulary check catches this.

const COLOR_PREFIXES = ["bg", "text", "border", "ring", "from", "to", "fill", "stroke"];

// Utilities that share a color prefix but set something other than a color.
// Kept explicit and small: anything not listed must be a token name.
const STRUCTURAL_SUFFIXES = new Set([
  "b", "t", "l", "r", "x", "y", // border sides
  "0", "2", "4", "8", // border widths
  "solid", "dashed", "dotted", "double", "none", "hidden", // border styles
  "transparent", // the CSS keyword — not a color token, not a hardcoded value
  "xs", "sm", "base", "lg", "xl", "2xl", "3xl", // Tailwind's default text sizes
  // …and the design's own type scale. Derived from the token module rather than
  // listed here, so adding a step cannot leave the guard rejecting a class that
  // is in fact valid — the two can never drift.
  ...Object.keys(typeScale),
  "left", "center", "right", "justify", // text alignment
  "wrap", "nowrap", "balance", "pretty", // text wrapping
  "ellipsis", "clip", // text overflow
]);

// Comments are stripped before scanning. Ordinary English matches these
// patterns — "click-outside-to-close" reads as the utility `to-close`, and a
// comment explaining why a class was AVOIDED flags the very class it warns
// about. A guard that fails on prose just teaches people to stop writing prose.
//
// The scan still covers the whole file rather than only className attributes,
// because the shared recipes (`BUTTON_PRIMARY`, `CHIP_BASE`, the badge tone
// map) are const strings — and those are exactly the class lists worth
// guarding, since each one is used in many places.
//
// `//` is only treated as a comment when it is not preceded by `:`, so a URL in
// a placeholder is not mistaken for one and does not swallow its line.
export function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

export function findUnknownTokenUtilities(src: string, knownColors: string[]): string[] {
  const known = new Set(knownColors);
  const hits: string[] = [];
  const re = new RegExp(`\\b(${COLOR_PREFIXES.join("|")})-([a-z0-9-]+)`, "g");
  for (const m of stripComments(src).matchAll(re)) {
    const [full, , suffix] = m;
    if (known.has(suffix) || STRUCTURAL_SUFFIXES.has(suffix)) continue;
    hits.push(full);
  }
  return hits;
}

describe("token-vocabulary guard", () => {
  it("has teeth — flags a class naming a token that no longer exists", () => {
    const known = Object.keys(tailwindTheme.colors);
    expect(findUnknownTokenUtilities(`<div className="border-hairline" />`, known)).toContain(
      "border-hairline",
    );
    // and does not flag legitimate structural or token classes
    expect(
      findUnknownTokenUtilities(`<div className="border-b border-border bg-surface text-sm text-muted" />`, known),
    ).toEqual([]);
    // …including the design's own type scale
    expect(
      findUnknownTokenUtilities(`<p className="text-body-lg text-heading" />`, known),
    ).toEqual([]);
  });

  it("does not read prose in comments as class names", () => {
    // English hyphenates. "click-outside-to-close" is not the utility
    // `to-close`, and a comment naming a class it deliberately avoided must not
    // fail the build for mentioning it.
    const known = Object.keys(tailwindTheme.colors);
    const src = `
      // a click-outside-to-close scrim; border-t-on-primary reads as a bogus
      // token to the guard, so the lit segment is set inline instead
      <div className="border-border" />
    `;
    expect(findUnknownTokenUtilities(src, known)).toEqual([]);
    // but a real class on the same file is still caught
    expect(
      findUnknownTokenUtilities(`${src}<div className="bg-hairline" />`, known),
    ).toContain("bg-hairline");
  });

  it("keeps a URL in a placeholder from swallowing its line", () => {
    const known = Object.keys(tailwindTheme.colors);
    expect(
      findUnknownTokenUtilities(
        `<input placeholder="https://…" className="text-nope" />`,
        known,
      ),
    ).toContain("text-nope");
  });

  it("no component names a color token outside the locked vocabulary", () => {
    const known = Object.keys(tailwindTheme.colors);
    const violations = walk(APP_DIR)
      .map((f) => ({ f, hits: findUnknownTokenUtilities(readFileSync(f, "utf8"), known) }))
      .filter((r) => r.hits.length > 0);

    if (violations.length > 0) {
      const report = violations
        .map((v) => `${path.relative(APP_DIR, v.f)}: ${[...new Set(v.hits)].join(", ")}`)
        .join("\n");
      throw new Error(
        `Classes name tokens that do not exist — these emit no CSS at all:\n${report}\n` +
          `Known token colors: ${known.join(", ")}`,
      );
    }
  });
});

// A third guard: a filled background must take its foreground from the paired
// `on-*` token, never from another background token.
//
// `bg-primary text-surface` is legible today by coincidence — `--color-surface`
// happens to contrast with `--color-primary` in both modes. That is luck, not
// design: it silently breaks the moment either value is retuned, and it breaks
// hardest for the brand overlay, where `--color-accent` becomes an arbitrary
// operator-supplied clinic color (#7). `--color-on-accent` exists precisely so
// a component never has to guess.

const FILLS = ["primary", "accent"];
const BACKGROUND_TOKENS = ["surface", "surface-raised"];

export function findMispairedForegrounds(src: string): string[] {
  const hits: string[] = [];
  // inspect each class list on its own, so unrelated elements don't cross-match
  for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
    const classes = m[1] ?? m[2] ?? "";
    for (const fill of FILLS) {
      if (!new RegExp(`\\bbg-${fill}\\b`).test(classes)) continue;
      for (const bg of BACKGROUND_TOKENS) {
        if (new RegExp(`\\btext-${bg}\\b`).test(classes)) {
          hits.push(`bg-${fill} paired with text-${bg} (use text-on-${fill})`);
        }
      }
    }
  }
  return hits;
}

describe("foreground-pairing guard", () => {
  it("has teeth — flags a fill whose foreground is a background token", () => {
    expect(findMispairedForegrounds(`<button className="rounded bg-primary text-surface" />`))
      .toHaveLength(1);
    // the correct pairing passes
    expect(findMispairedForegrounds(`<button className="rounded bg-primary text-on-primary" />`))
      .toEqual([]);
    // and unrelated elements are not cross-matched
    expect(
      findMispairedForegrounds(`<div className="bg-primary" /><p className="text-surface" />`),
    ).toEqual([]);
  });

  it("no component paints a fill with a background token as its foreground", () => {
    const violations = walk(APP_DIR)
      .map((f) => ({ f, hits: findMispairedForegrounds(readFileSync(f, "utf8")) }))
      .filter((r) => r.hits.length > 0);

    if (violations.length > 0) {
      const report = violations
        .map((v) => `${path.relative(APP_DIR, v.f)}: ${[...new Set(v.hits)].join(", ")}`)
        .join("\n");
      throw new Error(`Fills must use their paired on-* foreground token:\n${report}`);
    }
  });
});

describe("no-hardcoded-tokens guard", () => {
  it("has teeth — flags a known-bad snippet", () => {
    const bad = `
      <div className="bg-[#ffffff] text-[#000000] rounded-[8px]">x</div>
      <p style={{ color: "#0A6E7C", fontFamily: "Comic Sans" }}>hi</p>
    `;
    const hits = findHardcodedTokens(bad);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.startsWith("arbitrary color utility"))).toBe(true);
    expect(hits.some((h) => h.startsWith("arbitrary radius"))).toBe(true);
    expect(hits.some((h) => h.startsWith("inline font-family"))).toBe(true);
  });

  it("no component under app/ hardcodes a color, radius, or font", () => {
    const files = walk(APP_DIR);
    expect(files.length).toBeGreaterThan(0);

    const violations = files
      .map((f) => ({ f, hits: findHardcodedTokens(readFileSync(f, "utf8")) }))
      .filter((r) => r.hits.length > 0);

    if (violations.length > 0) {
      const report = violations
        .map((v) => `${path.relative(APP_DIR, v.f)}:\n  - ${v.hits.join("\n  - ")}`)
        .join("\n");
      throw new Error(
        `Components hardcode token values — restyle via lib/theme/tokens.ts instead:\n${report}`,
      );
    }
  });
});