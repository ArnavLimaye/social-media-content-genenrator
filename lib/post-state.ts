// POST-STATE — the state a Post is rendered in (issue #9).
// -----------------------------------------------------------------------------
// Deliberately its own module, with no imports at all. Every Board view needs
// this, and the views are client components; living in `lib/posts.ts` would drag
// that module's Prisma import into the browser bundle. The input is described
// structurally rather than as a `SerializedPost` so there is no import — not
// even a type-only one — back to the database layer.
//
// A Post's rendered state is not the same as its `status` column. When the
// copywriter call fails, the orchestrator saves the planner's outline and leaves
// every copy field null, keeping status "draft" (lib/generate-week.ts) — because
// "failed" is a generation outcome, not a point in the draft → approved →
// published lifecycle. Every view derives the state through here rather than
// reading `status`, so the kanban, week list, month cell, and drawer cannot
// disagree about whether a Post is missing its copy.

export type PostState = "failed" | string;

// The fields the derivation reads. Structural, so any Post-shaped value fits.
export type PostCopyFields = {
  status: string;
  hook: string | null;
  caption: string | null;
  cta: string | null;
  slides: unknown | null;
};

export function postState(post: PostCopyFields): PostState {
  return hasNoCopy(post) ? "failed" : post.status;
}

// Topic-only: the copywriter produced nothing at all. Any one surviving field
// counts as copy — a partial result is for the operator to judge, not for the
// app to label a failed run.
function hasNoCopy(post: Omit<PostCopyFields, "status">): boolean {
  return !post.hook && !post.caption && !post.cta && !post.slides;
}
