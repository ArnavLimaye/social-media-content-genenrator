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

// The Plan already covering the week this dashboard generates for, if any
// (issue #11). Its presence is what turns Generate into Regenerate;
// `draftCount` is how many drafts a regeneration would discard — the number the
// confirmation has to state before the operator commits.
export type WeekPlan = { label: string; draftCount: number };

export function ClientDashboard({
  client,
  blockedReason,
  weekPlan,
  onGenerate,
  onRegenerate,
}: {
  client: Identity;
  blockedReason: string | null;
  weekPlan: WeekPlan | null;
  onGenerate: (clientId: string) => Promise<GenerateResult>;
  onRegenerate: (clientId: string) => Promise<GenerateResult>;
}) {
  const [state, setState] = useState<DashboardState>({ kind: "idle" });
  // Regenerate is destructive, so the first click opens this confirmation
  // rather than discarding anything — the same two-step shape the review-flag
  // approval gate uses on the board.
  const [confirming, setConfirming] = useState(false);

  async function run(action: (clientId: string) => Promise<GenerateResult>) {
    if (state.kind === "generating") return; // prevent double-submit
    setState({ kind: "generating" });
    const result = await action(client.id);
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

        {/* A week may hold only one Plan, so once this week has one the
            generate affordance is replaced rather than left to be refused —
            and the reason travels with its remedy. */}
        {weekPlan && !blockedReason ? (
          <p role="alert" className="text-sm text-muted">
            This week already has a plan ({weekPlan.label}). Regenerate replaces its
            drafts.
          </p>
        ) : null}

        {weekPlan && !blockedReason ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={busy}
            className="self-start rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-60"
          >
            {busy ? "Regenerating…" : "Regenerate this week"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => run(onGenerate)}
            disabled={busy || blockedReason !== null}
            className="self-start rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-60"
          >
            {busy ? "Generating…" : "Generate this week"}
          </button>
        )}

        {confirming && weekPlan ? (
          <RegenerateConfirm
            draftCount={weekPlan.draftCount}
            onCancel={() => setConfirming(false)}
            onConfirm={() => {
              setConfirming(false);
              void run(onRegenerate);
            }}
          />
        ) : null}

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

// The confirmation standing between the operator and a destructive action. It
// states the count because "Regenerate this week" alone does not tell you
// whether you are discarding one draft or three — and it names what survives,
// since the fear this dialog has to answer is "will this eat my approved work?".
function RegenerateConfirm({
  draftCount,
  onCancel,
  onConfirm,
}: {
  draftCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const plural = draftCount === 1 ? "draft" : "drafts";
  return (
    <div
      role="dialog"
      aria-label="Confirm regenerate"
      className="flex flex-col gap-3 rounded-sm border border-border bg-surface-raised p-4"
    >
      <p className="text-sm text-text">
        Replace {draftCount} {plural} with freshly generated ones?
      </p>
      <p className="text-sm text-muted">
        Approved and published posts in this week are kept.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-sm bg-danger px-3 py-1.5 text-sm font-semibold text-on-primary"
        >
          Replace {draftCount} {plural}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-sm px-3 py-1.5 text-sm font-semibold text-muted hover:bg-surface hover:text-text"
        >
          Cancel
        </button>
      </div>
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