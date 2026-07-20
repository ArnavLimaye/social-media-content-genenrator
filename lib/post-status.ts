// POST-STATUS — the Post lifecycle and the review-flag approval gate (issue #10).
// -----------------------------------------------------------------------------
// Pure logic: no Prisma, no React. Imports only `post-state`, which itself has
// zero imports, so this module is safe in the client bundle (the footer actions
// on every Board view call into it) and testable without a database or a DOM.

import { postState } from "@/lib/post-state";

export type PostStatus = "draft" | "approved" | "published";

// The fields the lifecycle reads, described structurally so there is no import
// back to the database layer — the same discipline as `post-state.ts`.
export type PostLifecycleFields = {
  status: string;
  hook: string | null;
  caption: string | null;
  cta: string | null;
  slides: unknown | null;
  reviewFlags: unknown[] | null;
  flagsAcknowledgedAt: string | Date | null;
};

// The lifecycle, as data. One way, no "rejected": a bad draft is fixed by
// editing or regenerating (#11), not by moving it backwards. `published` is
// terminal because a published Post records what actually went out.
const TRANSITIONS: Record<PostStatus, readonly PostStatus[]> = {
  draft: ["approved"],
  approved: ["published"],
  published: [],
};

export function canTransition(from: string, to: string): boolean {
  return TRANSITIONS[from as PostStatus]?.includes(to as PostStatus) ?? false;
}

// Published Posts are read-only in every Board view. Takes the status rather
// than the Post because a generation-failed Post is still an editable draft —
// this asks about the lifecycle, not about the copy.
export function isEditable(status: string): boolean {
  return status !== "published";
}

// A Post with flags cannot advance to `approved` silently. The gate is *soft*:
// one informed acknowledgment covers every flag on the Post. It does not
// require editing the copy or clearing flags individually, because the operator
// may legitimately judge a flagged claim acceptable.
//
// Keyed off `postState`, not `post.status`, so a generation-failed Post — a
// topic-only draft with no copy at all — is never approvable. Its route out is
// regeneration (#11); approving it would queue an empty slot.
export function canApprove(
  post: PostLifecycleFields,
  acknowledged: boolean,
): boolean {
  if (postState(post) !== "draft") return false;
  return acknowledged || !needsAcknowledgment(post);
}

// True when the operator has not yet signed off on this Post's review flags —
// the condition that turns Approve into "Approve…" plus a confirmation.
export function needsAcknowledgment(post: PostLifecycleFields): boolean {
  return (post.reviewFlags?.length ?? 0) > 0 && !post.flagsAcknowledgedAt;
}
