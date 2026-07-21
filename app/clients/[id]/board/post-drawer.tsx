"use client";

import { useEffect } from "react";
import type { SerializedPost } from "@/lib/posts";
import { postState } from "@/lib/post-state";
import { dayLabel } from "@/lib/calendar";
import { Badge } from "@/app/ui";
import { PostCard, type PostCardProps } from "./post-card";
import { statusBadge } from "./post-badges";

// The editor drawer — opened by clicking a Post in the month grid, where a cell
// is too small to edit in. It holds the same PostCard the kanban and week list
// render, so the operator does not have to re-find anything.
//
// A scrim sits behind it, doing two jobs: it dims the grid so the drawer reads
// as being ON TOP rather than beside, and it gives the click-outside-to-close
// gesture something to land on. `shadow-md` completes the separation, since a
// border alone against a same-toned page is not enough to lift it.
//
// The card is keyed on the Post id. That is load-bearing, not incidental:
// InlineText seeds its state from props on mount, so a drawer that stayed
// mounted while a different Post was swapped in would keep showing the previous
// Post's text. Keying forces a remount per Post, which re-seeds every field. The
// alternative — re-seeding whenever the `value` prop changes — would clobber
// whatever the operator is mid-way through typing every time a server action
// revalidates the page.

export type PostDrawerProps = Pick<
  PostCardProps,
  "onEditField" | "onEditHashtags" | "onEditSlide" | "onApprove" | "onPublish"
> & {
  post: SerializedPost;
  onClose: () => void;
};

export function PostDrawer({ post, onClose, ...editing }: PostDrawerProps) {
  const status = statusBadge(postState(post));

  // Escape closes it. A panel that covers the page and traps the eye must be
  // dismissible from the keyboard, not only by finding the ✕.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div
        // Not a button: this is a click target for dismissal, and exposing it
        // to the accessibility tree would add a nameless control before the
        // drawer's own close button. Escape and ✕ are the accessible paths.
        aria-hidden="true"
        onClick={onClose}
        className="animate-fade-in fixed inset-0 z-40"
        style={{ background: "color-mix(in srgb, var(--color-text) 30%, transparent)" }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={post.topic}
        className="animate-drawer-in fixed inset-y-0 right-0 z-50 flex w-[540px] max-w-[92vw] flex-col border-l border-border bg-surface-raised shadow-md"
      >
        {/* The header bar states the date and status, which is why the card
            inside can drop both — in this mode they belong to the panel. */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <span className="text-control font-semibold text-text">
            {post.scheduledDate ? dayLabel(new Date(post.scheduledDate)) : "Unscheduled"}
          </span>
          <Badge tone={status.tone}>{status.label}</Badge>
          <span className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 flex-none items-center justify-center rounded-sm border border-border bg-transparent text-control text-muted hover:text-text"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <PostCard key={post.id} post={post} variant="drawer" {...editing} />
        </div>
      </div>
    </>
  );
}
