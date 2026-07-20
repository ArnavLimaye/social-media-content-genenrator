"use client";

import type { SerializedPost } from "@/lib/posts";
import { PostCard, type PostCardProps } from "./post-card";

// The kanban mode (issue #8) — that Client's Posts grouped into Draft /
// Approved / Published columns. Extracted from <Board> unchanged when #9 turned
// the Board into a mode switcher; this file owns grouping by status only.
//
// No color prop: accent-painted elements inside the cards (pillar badge,
// image-idea `creative` chips, hashtags, focus rings) read `--color-accent`,
// so the <BrandOverlay> wrapping the page rebrands the whole board per Client
// with zero component changes here (design-lock §4).

export type KanbanProps = Pick<
  PostCardProps,
  "onEditField" | "onEditHashtags" | "onEditSlide" | "onApprove" | "onPublish"
> & {
  posts: SerializedPost[];
};

const COLUMNS: Array<{ key: string; label: string; statuses: string[] }> = [
  { key: "draft", label: "Draft", statuses: ["draft", "failed"] },
  { key: "approved", label: "Approved", statuses: ["approved"] },
  { key: "published", label: "Published", statuses: ["published"] },
];

export function Kanban({ posts, ...editing }: KanbanProps) {
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
                <PostCard key={post.id} post={post} {...editing} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
