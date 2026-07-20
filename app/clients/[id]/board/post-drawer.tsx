"use client";

import type { SerializedPost } from "@/lib/posts";
import { PostCard, type PostCardProps } from "./post-card";

// The editor drawer (issue #9) — opened by clicking a Post in the month grid,
// where a cell is too small to edit in. It holds the same PostCard the kanban
// and week list render, so the operator does not have to re-find anything
// (design-lock §2).
//
// The card is keyed on the Post id. That is load-bearing, not incidental:
// InlineText seeds its state from props on mount, so a drawer that stayed
// mounted while a different Post was swapped in would keep showing the previous
// Post's text (the limitation #8 recorded on close). Keying forces a remount
// per Post, which re-seeds every field. The alternative — re-seeding whenever
// the `value` prop changes — would clobber whatever the operator is mid-way
// through typing every time a server action revalidates the page.

export type PostDrawerProps = Pick<
  PostCardProps,
  "onEditField" | "onEditHashtags" | "onEditSlide" | "onApprove" | "onPublish"
> & {
  post: SerializedPost;
  onClose: () => void;
};

export function PostDrawer({ post, onClose, ...editing }: PostDrawerProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={post.topic}
      className="fixed inset-y-0 right-0 z-10 flex w-full max-w-lg flex-col gap-3 overflow-y-auto border-l border-border bg-surface p-5 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted">Edit post</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-sm border border-border px-2 py-1 text-sm text-muted hover:bg-surface-raised hover:text-text"
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>
      <PostCard key={post.id} post={post} showDateLine={false} {...editing} />
    </div>
  );
}
