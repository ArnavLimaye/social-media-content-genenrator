"use server";

import { revalidatePath } from "next/cache";
import {
  approvePost,
  publishPost,
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
// Lifecycle actions (#10). Unlike the edit actions above, these change which
// kanban column and which calendar badge a Post belongs to, so the Board has to
// re-read: `revalidatePath` refreshes the server-rendered post list, and every
// mode picks the change up at once. The rules — including the acknowledgment
// gate — are enforced inside `lib/posts.ts`, not here; this stays a thin shell.

// `clientId` comes first so the page can `.bind(null, clientId)` and hand the
// card a plain `(postId, acknowledged)` callback — the Board views stay unaware
// that a revalidation target exists.
export async function approvePostAction(
  clientId: string,
  postId: string,
  acknowledged: boolean,
): Promise<void> {
  await approvePost(postId, acknowledged);
  revalidatePath(`/clients/${clientId}/board`);
}

export async function publishPostAction(
  clientId: string,
  postId: string,
): Promise<void> {
  await publishPost(postId);
  revalidatePath(`/clients/${clientId}/board`);
}
