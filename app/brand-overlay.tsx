import type { CSSProperties } from "react";
import { brandAccentVars } from "@/lib/theme/brand";

// Scopes a Client's brand accent over its subtree (issue #7 design lock).
//
// Wrap a Client's screens in this and every `accent`-derived class inside —
// pillar chips, image-idea chips, hashtags, the logo tile — picks up that
// clinic's color. No child component takes a color prop, and none needs to
// change to support branding.
//
// The parsing (and the decision that only the accent is overridable) lives in
// lib/theme/brand.ts; this component is only the mounting point.
export function BrandOverlay({
  colors,
  children,
}: {
  colors: string | null | undefined;
  children: React.ReactNode;
}) {
  const vars = brandAccentVars(colors) as CSSProperties;
  return <div style={vars}>{children}</div>;
}
