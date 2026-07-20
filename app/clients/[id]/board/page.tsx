import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/app/shell";
import { BrandOverlay } from "@/app/brand-overlay";
import { prisma } from "@/lib/db";
import { listPostsForClient } from "@/lib/posts";
import { BoardClient } from "./board-client";
import { editPostField, editPostHashtags, editPostSlide } from "./actions";

// Screen 3 (issues #8, #9) — the Board: one view over a Client's Posts with
// switchable kanban / week-list / month-grid modes. A server component that
// loads the clinic + its posts, wraps them in the per-Client brand overlay, and
// hands the real edit server actions down. The modes own grouping, placement,
// and inline editing; this page is just the shell that connects a Client to its
// posts and actions.
//
// `today` is resolved here, on the server, so the calendar modes anchor on one
// agreed date instead of each client re-reading its own clock.
// Token-derived classes only (ADR-0003).
export default async function BoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { id } = await params;
  const { view } = await searchParams;
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
          <BoardClient
            posts={posts}
            today={new Date().toISOString()}
            urlView={view ?? null}
            onEditField={editPostField}
            onEditHashtags={editPostHashtags}
            onEditSlide={editPostSlide}
          />
        </div>
      </BrandOverlay>
    </Shell>
  );
}