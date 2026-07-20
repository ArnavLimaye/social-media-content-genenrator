"use client";

import type { SerializedPost } from "@/lib/posts";
import { PostCard, type PostCardProps } from "./post-card";

// The Board (issue #8) — a per-Client kanban over that Client's Posts, grouped
// into Draft / Approved / Published columns. Each Post renders as a PostCard.
//
// No color prop: accent-painted elements inside the cards (pillar badge,
// image-idea `creative` chips, hashtags, focus rings) read `--color-accent`,
// so the <BrandOverlay> wrapping the page rebrands the whole board per Client
// with zero component changes here (design-lock §4). Editing is delegated to
// the cards via the same injected callbacks the page wires to server actions.

export type BoardProps = Pick<PostCardProps, "onEditField" | "onEditHashtags" | "onEditSlide"> & {
  posts: SerializedPost[];
};

const COLUMNS: Array<{ key: string; label: string; statuses: string[] }> = [
  { key: "draft", label: "Draft", statuses: ["draft", "failed"] },
  { key: "approved", label: "Approved", statuses: ["approved"] },
  { key: "published", label: "Published", statuses: ["published"] },
];

export function Board({ posts, onEditField, onEditHashtags, onEditSlide }: BoardProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {COLUMNS.map((col) => {
        const colPosts = posts.filter((p) => col.statuses.includes(p.status));
        return (
          <section key={col.key} aria-label={col.label} className="flex flex-col gap-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted">
              {col.label}
              <span className="ml-2 text-xs font-normal text-muted">{colPosts.length}</span>
            </h2>
            <div className="flex flex-col gap-3">
              {colPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onEditField={onEditField}
                  onEditHashtags={onEditHashtags}
                  onEditSlide={onEditSlide}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}