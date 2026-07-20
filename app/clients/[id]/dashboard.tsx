"use client";

import { useState } from "react";
import Link from "next/link";
import type { Client } from "@/generated/prisma/client";
import { Card, ClinicTile, MicroLabel } from "@/app/ui";

// The Client dashboard (issue #6). Shows the clinic's identity and a
// "Generate this week" button, and honestly handles every generation state
// (pending, success, partial success, failure, blocked). Generation runs
// through an injected `onGenerate(clientId)` prop — the page wires it to the
// real server action, so this component is testable with a fake and survives
// any change to how generation is actually invoked. Token-derived classes
// only (ADR-0003) — including the brand-accent swatch, which paints from
// `bg-accent`. The clinic's own color reaches that token via <BrandOverlay>
// higher up the tree (issue #7), so this component holds no runtime color.

export type DraftPost = {
  id: string;
  topic: string;
  pillar: string;
  format: string;
  scheduledDate: string; // ISO — Date crosses the server→client boundary as a string
};

export type GenerateResult =
  | { ok: true; plan: { id: string; label: string }; posts: DraftPost[]; warnings: string[] }
  | { ok: false; error: string };

type DashboardState =
  | { kind: "idle" }
  | { kind: "generating" }
  | { kind: "success"; posts: DraftPost[]; warnings: string[] }
  | { kind: "error"; message: string };

type Identity = Pick<Client, "id" | "name" | "logoUrl" | "colors">;

export function ClientDashboard({
  client,
  blockedReason,
  onGenerate,
}: {
  client: Identity;
  blockedReason: string | null;
  onGenerate: (clientId: string) => Promise<GenerateResult>;
}) {
  const [state, setState] = useState<DashboardState>({ kind: "idle" });

  async function handleGenerate() {
    if (state.kind === "generating") return; // prevent double-submit
    setState({ kind: "generating" });
    const result = await onGenerate(client.id);
    if (result.ok) {
      setState({ kind: "success", posts: result.posts, warnings: result.warnings });
    } else {
      setState({ kind: "error", message: result.error });
    }
  }

  const busy = state.kind === "generating";

  return (
    <div className="flex flex-col gap-4 font-sans">
      <Card>
        <header className="flex items-center gap-4">
          <ClinicTile name={client.name} logoUrl={client.logoUrl} />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 className="text-xl font-semibold tracking-tight text-text">{client.name}</h2>
            {client.colors ? (
              <div className="flex items-center gap-2">
                <span
                  aria-label="Brand accent"
                  className="inline-block h-4 w-4 rounded-sm border border-border bg-accent"
                />
                <span className="text-sm text-muted">{client.colors}</span>
              </div>
            ) : null}
          </div>
          <Link
            href={`/clients/${client.id}/board`}
            className="rounded-sm px-3 py-1.5 text-sm font-semibold text-muted hover:bg-surface hover:text-text"
          >
            Board →
          </Link>
        </header>
      </Card>

      <Card className="flex flex-col gap-3">
        <MicroLabel>Generation</MicroLabel>

        {blockedReason ? (
          <p role="alert" className="text-sm text-muted">
            {blockedReason}
          </p>
        ) : null}

        <button
          type="button"
          onClick={handleGenerate}
          disabled={busy || blockedReason !== null}
          className="self-start rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-60"
        >
          {busy ? "Generating…" : "Generate this week"}
        </button>

        {state.kind === "generating" ? (
          <p className="text-sm text-muted" role="status">
            Generating drafts…
          </p>
        ) : null}

        {state.kind === "error" ? (
          <p role="alert" className="text-sm text-danger">
            {state.message}
          </p>
        ) : null}
      </Card>

      {state.kind === "success" ? (
        <DraftList posts={state.posts} warnings={state.warnings} />
      ) : null}
    </div>
  );
}

function DraftList({
  posts,
  warnings,
}: {
  posts: DraftPost[];
  warnings: string[];
}) {
  return (
    <div className="flex flex-col gap-2">
      {warnings.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {warnings.map((w, i) => (
            // `warning`, not `danger`: a partial generation produced usable
            // drafts. Painting it as an error would overstate the failure.
            <li
              key={i}
              role="alert"
              className="rounded-sm border border-warning bg-surface-raised px-3 py-2 text-sm text-warning"
            >
              {w}
            </li>
          ))}
        </ul>
      ) : null}
      {posts.length > 0 ? (
        <ul className="flex flex-col gap-2 text-text">
          {posts.map((p) => (
            <DraftRow key={p.id} post={p} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function DraftRow({ post }: { post: DraftPost }) {
  return (
    <li className="rounded border border-border bg-surface-raised px-4 py-3 shadow-sm">
      <p className="font-semibold text-text">{post.topic}</p>
      <p className="text-sm text-muted">
        <span>{post.pillar}</span>
        <span aria-hidden="true"> · </span>
        <span>{post.format}</span>
        <span aria-hidden="true"> · </span>
        <span>{formatDate(post.scheduledDate)}</span>
      </p>
    </li>
  );
}

// YYYY-MM-DD from an ISO string — the scheduled date, shown without time or
// timezone noise. The Post's scheduledDate crosses the server→client boundary
// as an ISO string, so this is pure string arithmetic (no Date parsing).
function formatDate(iso: string): string {
  return iso.slice(0, 10);
}