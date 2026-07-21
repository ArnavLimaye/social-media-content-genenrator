import { notFound } from "next/navigation";
import { Shell } from "@/app/shell";
import { BrandOverlay } from "@/app/brand-overlay";
import { prisma } from "@/lib/db";
import { listPostsForClient } from "@/lib/posts";
import { BoardClient } from "./board-client";
import {
  approvePostAction,
  editPostField,
  editPostHashtags,
  editPostSlide,
  publishPostAction,
} from "./actions";

// The Board: one view over a Client's Posts with switchable kanban / week-list /
// month-grid modes. A server component that loads the clinic + its posts, wraps
// them in the per-Client brand overlay, and hands the real edit server actions
// down. The modes own grouping, placement, and inline editing; this page is just
// the shell that connects a Client to its posts and actions.
//
// The clinic identity goes INTO the Board rather than being rendered above it,
// because the design puts it on the same row as the view switcher and the
// period stepper — one control surface, not a title band plus a toolbar.
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
    <Shell width="board" nav="clients">
      <BrandOverlay colors={client.colors}>
        <BoardClient
          posts={posts}
          clinicName={client.name}
          clinicLogoUrl={client.logoUrl}
          pillars={{
            Monday: client.pillarMon,
            Wednesday: client.pillarWed,
            Friday: client.pillarFri,
          }}
          today={new Date().toISOString()}
          urlView={view ?? null}
          onEditField={editPostField}
          onEditHashtags={editPostHashtags}
          onEditSlide={editPostSlide}
          onApprove={approvePostAction.bind(null, client.id)}
          onPublish={publishPostAction.bind(null, client.id)}
        />
      </BrandOverlay>
    </Shell>
  );
}
