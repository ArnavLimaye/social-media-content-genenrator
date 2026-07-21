"use client";

import { useEffect, useState } from "react";

// The color-mode control, built to the design's three-state cycler.
//
// Three states, not two, because "auto" is a real choice and not the absence of
// one: with no [data-theme] set, prefers-color-scheme drives the mode, and an
// operator who wanted that back had no way to ask for it from a two-way toggle.
//
// The mode lives in the DOM attribute and localStorage, never in component
// state alone — the no-flash script in layout.tsx sets the attribute before
// paint, so state seeded at mount would disagree with what is already on
// screen. This reads the DOM on every cycle for the same reason.
type Mode = "auto" | "light" | "dark";

const NEXT: Record<Mode, Mode> = { auto: "light", light: "dark", dark: "auto" };

// The glyph carries the mode alongside the word, so the control is scannable at
// a glance without the meaning being color-only.
const LABEL: Record<Mode, string> = {
  auto: "◐ Auto",
  light: "○ Light",
  dark: "● Dark",
};

function read(): Mode {
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "light" || attr === "dark" ? attr : "auto";
}

function apply(mode: Mode) {
  const root = document.documentElement;
  if (mode === "auto") {
    root.removeAttribute("data-theme");
    // Removing the KEY, not storing "auto": the no-flash script treats a
    // missing key as "let the media query decide", which is what auto means.
    try {
      localStorage.removeItem("theme");
    } catch {
      /* storage unavailable (private mode) — the attribute still applies */
    }
    return;
  }
  root.setAttribute("data-theme", mode);
  try {
    localStorage.setItem("theme", mode);
  } catch {
    /* as above */
  }
}

export function ThemeToggle() {
  // Rendered as "auto" on the server and on first paint, then corrected from
  // the DOM. Seeding from `document` directly would break server rendering.
  const [mode, setMode] = useState<Mode>("auto");
  useEffect(() => setMode(read()), []);

  function cycle() {
    const next = NEXT[read()];
    apply(next);
    setMode(next);
  }

  return (
    <button
      type="button"
      onClick={cycle}
      title="Cycle color mode"
      aria-label={`Color mode: ${mode}. Activate to cycle.`}
      className="whitespace-nowrap rounded-sm border border-border bg-transparent px-2.5 py-[5px] text-body font-medium text-muted hover:text-text"
    >
      {LABEL[mode]}
    </button>
  );
}
