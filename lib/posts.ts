import { prisma } from "@/lib/db";
import type { Post } from "@/generated/prisma/client";

// Deep module behind the Board (issue #8): reads a Client's Posts and owns the
// inline-edit persistence. The Board UI is a thin shell over this — a small
// interface over Prisma, with the slide-document rewrite (ADR-0001) factored
// into a pure, exported function so the critical correctness behavior is
// testable without the database.
//
// A Post's copywriter output is a document: scalar columns (hook/caption/cta)
// plus Json fields (slides/hashtags/reviewFlags). Inline editing rewrites the
// relevant field; a slide edit rewrites the whole `slides` document, never a
// per-slide row.

// One text block within a carousel/reel (CONTEXT.md). Stored as a document on
// the Post, not a table (ADR-0001).
export type ImageIdeaType = "creative" | "photo";
export type ImageIdea = { type: ImageIdeaType; idea: string };
export type Slide = {
  heading: string;
  description: string;
  imageIdeas: ImageIdea[];
};

// A copywriter-generated { claim, reason } pair (CONTEXT.md). A spotlight, not
// a filter — the board shows each flag's claim and reason inline.
export type ReviewFlag = { claim: string; reason: string };

// A Post with Dates serialized to ISO strings (they cross the server→client
// boundary as strings, per the existing DraftPost convention) and the Json
// document fields typed. This is the shape the Board client component renders.
export type SerializedPost = Omit<
  Post,
  "scheduledDate" | "publishedAt" | "flagsAcknowledgedAt" | "slides" | "hashtags" | "reviewFlags" | "createdAt"
> & {
  scheduledDate: string | null;
  publishedAt: string | null;
  flagsAcknowledgedAt: string | null;
  createdAt: string;
  slides: Slide[] | null;
  hashtags: string[] | null;
  reviewFlags: ReviewFlag[] | null;
};

// The scalar copy fields an inline edit can target. `hashtags` is handled
// separately (it is a Json array, not a string column).
export type ScalarField = "hook" | "caption" | "cta";

// The fields of a single Slide an inline edit can target. Image ideas are not
// in this set — the issue scopes editing to heading + description.
export type SlideField = "heading" | "description";

// Pure, immutable: rewrite one slide's field and return a NEW slides document,
// preserving every other slide and all image ideas (ADR-0001). The issue's
// explicit correctness requirement — "without corrupting other slides or their
// image ideas" — lives here, independent of the database, so it is tested
// directly. `updatePostSlide` is a thin shell over this.
export function setSlideField(
  slides: Slide[],
  index: number,
  field: SlideField,
  value: string,
): Slide[] {
  return slides.map((slide, i) =>
    i === index ? { ...slide, [field]: value } : slide,
  );
}

// Coerce a Prisma `Post` (Dates + untyped Json) into the SerializedPost the
// Board renders. Json fields are cast to their typed shapes; a null document
// stays null. Dates become ISO strings so they survive the server→client
// boundary. Kept as a helper so every read path serializes identically.
function serializePost(post: Post): SerializedPost {
  return {
    ...post,
    createdAt: post.createdAt.toISOString(),
    scheduledDate: post.scheduledDate ? post.scheduledDate.toISOString() : null,
    publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
    flagsAcknowledgedAt: post.flagsAcknowledgedAt
      ? post.flagsAcknowledgedAt.toISOString()
      : null,
    slides: post.slides as Slide[] | null,
    hashtags: post.hashtags as string[] | null,
    reviewFlags: post.reviewFlags as ReviewFlag[] | null,
  };
}

// All of one Client's Posts, ordered by scheduled date ascending so a kanban
// column reads top-to-bottom in schedule order. Only that Client's posts —
// another Client's posts never leak into the board (one local DB, but the
// board is per-Client).
export async function listPostsForClient(
  clientId: string,
): Promise<SerializedPost[]> {
  const posts = await prisma.post.findMany({
    where: { clientId },
    orderBy: { scheduledDate: "asc" },
  });
  return posts.map(serializePost);
}

// Persist an inline edit of one scalar copy field (hook / caption / cta). The
// field set is closed: a name outside it is a programmer error, not a silent
// write to an arbitrary column.
const SCALAR_FIELDS: ReadonlySet<ScalarField> = new Set(["hook", "caption", "cta"]);

export async function updatePostField(
  postId: string,
  field: ScalarField,
  value: string,
): Promise<void> {
  if (!SCALAR_FIELDS.has(field)) {
    throw new Error(`updatePostField: unknown field "${field}"`);
  }
  await prisma.post.update({ where: { id: postId }, data: { [field]: value } });
}

// Persist an inline edit of the hashtag list (a Json array). The component
// splits operator-typed text into this array; this writes it as one document.
export async function updatePostHashtags(
  postId: string,
  hashtags: string[],
): Promise<void> {
  await prisma.post.update({ where: { id: postId }, data: { hashtags } });
}

// Persist an inline edit of one slide field. Reads the current `slides`
// document, rewrites it with the pure `setSlideField` (which preserves every
// other slide and all image ideas), and writes the whole document back as one
// update — the ADR-0001 pattern: a slide edit is a document rewrite, not a
// per-slide row update. Throws if the post has no slides document.
export async function updatePostSlide(
  postId: string,
  index: number,
  field: SlideField,
  value: string,
): Promise<void> {
  const post = await prisma.post.findUniqueOrThrow({ where: { id: postId } });
  const slides = (post.slides as Slide[] | null) ?? [];
  const next = setSlideField(slides, index, field, value);
  await prisma.post.update({ where: { id: postId }, data: { slides: next } });
}