"use client";

import type { SerializedPost } from "@/lib/posts";
import { postState } from "@/lib/post-state";
import type { BadgeTone } from "@/app/ui";

// The Post's badge VOCABULARY, in one place because it is rendered at two very
// different sizes: the full card and the month-grid cell summary. A month cell
// and a card must never disagree about what "approved" looks like, which is
// exactly what happens when the recipe is copied.
//
// This module maps a lifecycle state to a label and a TONE — a token name, not
// a class list. The <Badge> primitive owns how a tone is painted, so restyling
// every badge in the app is one edit there rather than four here.

// Format badge glyph: carousel ▤, reel ▶, infographic ◫.
const FORMAT_GLYPH: Record<string, string> = {
  carousel: "▤",
  reel: "▶",
  infographic: "◫",
};

const STATUS_BADGE: Record<string, { label: string; tone: BadgeTone }> = {
  draft: { label: "Draft", tone: "muted" },
  approved: { label: "Approved", tone: "accent" },
  published: { label: "✓ Published", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
};

export function statusBadge(status: string) {
  return STATUS_BADGE[status] ?? STATUS_BADGE.draft;
}

export function formatGlyph(format: string): string {
  return FORMAT_GLYPH[format] ?? FORMAT_GLYPH.carousel;
}

// A tone names a Tailwind color key; the underlying custom property is not
// always the same word (`muted` is painted from `--color-text-muted`). This is
// the one place that translation lives.
const TONE_VAR: Record<BadgeTone, string> = {
  muted: "--color-text-muted",
  accent: "--color-accent",
  success: "--color-success",
  danger: "--color-danger",
  warning: "--color-warning",
};

// The status DOT the month grid uses. A cell has no room for a badge, so the
// state is carried by a dot plus the state's name in words — the color is never
// the only signal.
export function StatusDot({ tone }: { tone: BadgeTone }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-[7px] w-[7px] flex-none rounded-pill"
      // Inline because the tone is a RUNTIME value: a `bg-${tone}` template
      // never appears in the source, so Tailwind would purge the class.
      style={{ background: `var(${TONE_VAR[tone]})` }}
    />
  );
}

// The flag indicator. On the card this expands into the claim → reason list; in
// a month cell there is no room for that, so it is a mute marker whose
// accessible name still carries the count — a screen-reader user learns a Post
// needs review without having to open it.
export function FlagIndicator({ count }: { count: number }) {
  return (
    <span
      aria-label={`${count} review flag${count === 1 ? "" : "s"}`}
      className="text-body-xs text-warning"
    >
      <span aria-hidden="true">⚑</span>
    </span>
  );
}

// The compact summary a month-grid cell shows: format and flag marker, topic
// clamped to two lines, then the status dot with its name. Deliberately not the
// card — a cell is an overview, and clicking it opens the drawer where the full
// copy is editable.
export function PostSummary({ post }: { post: SerializedPost }) {
  const status = statusBadge(postState(post));
  const flags = post.reviewFlags?.length ?? 0;

  return (
    <span className="flex w-full flex-col gap-[3px] text-left">
      <span className="flex w-full items-center gap-1 text-label-xs font-bold uppercase text-muted">
        {post.format}
        <span className="flex-1" />
        {flags > 0 ? <FlagIndicator count={flags} /> : null}
      </span>
      <span className="line-clamp-2 text-body-sm font-semibold text-text">
        {post.topic}
      </span>
      <span className="flex items-center gap-1.5 text-label-lg font-normal normal-case text-muted">
        <StatusDot tone={status.tone} />
        {status.label}
      </span>
    </span>
  );
}
