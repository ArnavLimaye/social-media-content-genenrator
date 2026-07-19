import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

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