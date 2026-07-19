import type { TokenMap } from "./tokens";

// The per-Client brand overlay, as token overrides (issue #7 design lock).
//
// `Client.colors` is operator-entered free text ("#0aa2c0, #f59e0b"), so it is
// the one place a runtime color enters the themed UI. Everything downstream
// still reads `var(--color-accent)` — the overlay only changes what that name
// resolves to inside one Client's subtree, which is why per-Client branding
// costs zero component changes (ADR-0003).
//
// Deliberately narrow: the FIRST color becomes the accent, and nothing else is
// overridden. Letting a Client repaint `--color-surface` or `--color-text`
// would let bad brand data destroy contrast and make the app unreadable; the
// accent is the one token whose value the layout does not depend on.

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export function brandAccentVars(colors: string | null | undefined): TokenMap {
  const first = (colors ?? "").split(",")[0]?.trim() ?? "";
  if (!HEX.test(first)) return {};
  return { "--color-accent": first };
}
