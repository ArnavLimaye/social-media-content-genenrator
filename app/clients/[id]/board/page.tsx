import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/app/shell";
import { BrandOverlay } from "@/app/brand-overlay";
import { prisma } from "@/lib/db";
import { listPostsForClient } from "@/lib/posts";
import { Board } from "./board";
import { editPostField, editPostHashtags, editPostSlide } from "./actions";

// Screen 3a (issue #8) — the Board, a per-Client kanban over that Client's
// Posts. A server component that loads the clinic + its posts, wraps them in
// the per-Client brand overlay, and hands the real edit server actions to the
// <Board> client component. The board owns grouping + inline editing; this
// page is just the shell that connects a Client to its posts and actions.
// Token-derived classes only (ADR-0003).
export default async function BoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) notFound();

  const posts = await listPostsForClient(id);

  return (
    <Shell>
      <BrandOverlay colors={client.colors}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <h1 className="text-xl font-semibold tracking-tight text-text">
                {client.name}
              </h1>
              <p className="text-sm text-muted">Board</p>
            </div>
            <Link
              href={`/clients/${client.id}`}
              className="rounded-sm px-3 py-1.5 text-sm font-semibold text-muted hover:bg-surface hover:text-text"
            >
              ← Dashboard
            </Link>
          </div>
          <Board
            posts={posts}
            onEditField={editPostField}
            onEditHashtags={editPostHashtags}
            onEditSlide={editPostSlide}
          />
        </div>
      </BrandOverlay>
    </Shell>
  );
}