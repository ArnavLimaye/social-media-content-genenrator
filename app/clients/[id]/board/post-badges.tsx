"use client";

import type { SerializedPost } from "@/lib/posts";
import { postState } from "@/lib/post-state";

// The Post's badge vocabulary, in one place because it is rendered at two very
// different sizes: the full card (design-lock §2) and the month-grid cell
// summary. A month cell and a card must never disagree about what "approved"
// looks like, which is exactly what happens when the recipe is copied.

// Format badge glyph (design-lock §2): carousel ▤, reel ▶, infographic ◫.
const FORMAT_GLYPH: Record<string, string> = {
  carousel: "▤",
  reel: "▶",
  infographic: "◫",
};

// Status badge recipe (design-lock §2): one shared shape, colored per status.
const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-muted/10 border-muted/25 text-muted" },
  approved: { label: "Approved", cls: "bg-accent/10 border-accent/25 text-accent" },
  published: { label: "✓ Published", cls: "bg-success/10 border-success/25 text-success" },
  failed: { label: "Failed", cls: "bg-danger/10 border-danger/25 text-danger" },
};

export function statusBadge(status: string) {
  return STATUS_BADGE[status] ?? STATUS_BADGE.draft;
}

export function formatGlyph(format: string): string {
  return FORMAT_GLYPH[format] ?? FORMAT_GLYPH.carousel;
}

// The flag indicator. On the card this expands into the claim → reason list
// (design-lock §3); in a month cell there is no room for that, so it is a mute
// marker whose accessible name still carries the count — a screen-reader user
// learns a Post needs review without having to open it.
export function FlagIndicator({ count }: { count: number }) {
  return (
    <span
      aria-label={`${count} review flag${count === 1 ? "" : "s"}`}
      className="rounded-pill bg-warning/10 px-1 text-[10px] font-bold text-warning"
    >
      <span aria-hidden="true">⚑ {count}</span>
    </span>
  );
}

// The compact summary a month-grid cell shows: topic, format, status, flag
// indicator (issue #9). Deliberately not the card — a cell is an overview, and
// clicking it opens the drawer where the full copy is editable.
export function PostSummary({ post }: { post: SerializedPost }) {
  const status = statusBadge(postState(post));
  const flags = post.reviewFlags?.length ?? 0;

  return (
    <span className="flex flex-col gap-0.5 text-left">
      <span className="flex items-center gap-1">
        <span className="text-[10px] uppercase tracking-wider text-muted">
          <span aria-hidden="true">{formatGlyph(post.format)}</span> {post.format}
        </span>
        {flags > 0 ? <FlagIndicator count={flags} /> : null}
      </span>
      <span className="line-clamp-2 text-xs font-medium text-text">{post.topic}</span>
      <span
        className={`self-start rounded-pill border px-1 text-[10px] font-bold uppercase tracking-wider ${status.cls}`}
      >
        {status.label}
      </span>
    </span>
  );
}
