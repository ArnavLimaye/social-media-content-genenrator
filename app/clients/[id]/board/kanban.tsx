"use client";

import type { SerializedPost } from "@/lib/posts";
import { PostCard, type PostCardProps } from "./post-card";

// The kanban mode — that Client's Posts grouped into Draft / Approved /
// Published columns. This file owns grouping by status only.
//
// A column is a TINTED WELL, not a bare stack: `text` at 3% over the page, which
// darkens the trough in light mode and lightens it in dark, so the cards read as
// sitting inside a column rather than floating in a three-across grid. Without
// it the column boundaries are invisible the moment two columns hold a different
// number of cards.
//
// `items-start` matters — without it the CSS grid stretches every column to the
// height of the tallest, and a column holding one card gets a metre of empty
// tinted space below it.
//
// No color prop: accent-painted elements inside the cards read `--color-accent`,
// so the <BrandOverlay> wrapping the page rebrands the whole board per Client
// with zero component changes here.

export type KanbanProps = Pick<
  PostCardProps,
  "onEditField" | "onEditHashtags" | "onEditSlide" | "onApprove" | "onPublish"
> & {
  posts: SerializedPost[];
};

const COLUMNS: Array<{
  key: string;
  label: string;
  statuses: string[];
  emptyNote: string;
}> = [
  // A failed Post lives in Draft: it occupies a slot that still needs work,
  // which is exactly what Draft means. A fourth column for it would imply a
  // lifecycle stage that does not exist.
  {
    key: "draft",
    label: "Draft",
    statuses: ["draft", "failed"],
    emptyNote: "Nothing in draft",
  },
  {
    key: "approved",
    label: "Approved",
    statuses: ["approved"],
    emptyNote: "Nothing approved yet",
  },
  {
    key: "published",
    label: "Published",
    statuses: ["published"],
    emptyNote: "Nothing published yet",
  },
];

export function Kanban({ posts, ...editing }: KanbanProps) {
  return (
    <div className="grid items-start gap-4 sm:grid-cols-3">
      {COLUMNS.map((col) => {
        const colPosts = posts.filter((p) => col.statuses.includes(p.status));
        return (
          <section
            key={col.key}
            aria-label={col.label}
            className="rounded border border-border bg-text/[0.03] p-3"
          >
            <div className="flex items-center gap-2 px-2 pb-3 pt-1">
              <h2 className="text-body-sm font-bold uppercase tracking-wider text-muted">
                {col.label}
              </h2>
              <span className="rounded-pill bg-accent/12 px-[7px] text-body-xs font-bold text-accent">
                {colPosts.length}
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {colPosts.map((post) => (
                <PostCard key={post.id} post={post} variant="kanban" {...editing} />
              ))}
              {/* A dashed placeholder reads as a column with room in it, where
                  a blank trough reads as content that failed to load. */}
              {colPosts.length === 0 ? (
                <p className="rounded-sm border border-dashed border-border p-5 text-center text-body-lg text-muted">
                  {col.emptyNote}
                </p>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}
