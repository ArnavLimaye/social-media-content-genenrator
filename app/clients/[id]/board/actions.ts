"use server";

import {
  updatePostField,
  updatePostHashtags,
  updatePostSlide,
  type ScalarField,
  type SlideField,
} from "@/lib/posts";

// Server actions backing the Board's inline editing (issue #8). Thin shells
// over the tested `lib/posts.ts` module — same relationship `generateThisWeek`
// has to `generateWeek`. The module's behavior (scalar persistence, hashtag
// array, the slide-document rewrite that preserves other slides and image
// ideas) is fully covered by tests/posts.spec.ts; this is just the wiring from
// the client component's blur-commit to the database.

export async function editPostField(
  postId: string,
  field: ScalarField,
  value: string,
): Promise<void> {
  await updatePostField(postId, field, value);
}

export async function editPostHashtags(
  postId: string,
  hashtags: string[],
): Promise<void> {
  await updatePostHashtags(postId, hashtags);
}

export async function editPostSlide(
  postId: string,
  slideIndex: number,
  field: SlideField,
  value: string,
): Promise<void> {
  await updatePostSlide(postId, slideIndex, field, value);
}