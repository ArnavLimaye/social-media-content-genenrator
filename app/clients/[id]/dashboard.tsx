"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  Card,
  ClinicTile,
  MicroLabel,
  PillarChip,
  Spinner,
} from "@/app/ui";

// The Client dashboard, built to the Content Back-Office design.
//
// Two bands. The IDENTITY card states who this clinic is — name, location and
// audience, brand colors, and the three pillars with the day each one runs on.
// Below it a `1.4fr | 1fr` row pairs the generation control with the token
// panel: the action on the left where the eye lands, its cost on the right.
//
// Generation runs through an injected `onGenerate(clientId)` prop — the page
// wires it to the real server action, so this component is testable with a fake
// and survives any change to how generation is actually invoked. Token-derived
// classes only (ADR-0003), including the brand swatches, which paint from
// `bg-accent`: the clinic's own color reaches that token via <BrandOverlay>
// higher up the tree, so this component holds no runtime color.

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

export type Identity = {
  id: string;
  name: string;
  logoUrl: string | null;
  colors: string | null;
  location: string | null;
  audience: string | null;
  pillars: string[];
};

// The Plan already covering the week this dashboard generates for, if any. Its
// presence is what turns Generate into Regenerate; `draftCount` is how many
// drafts a regeneration would discard — the number the confirmation has to state
// before the operator commits.
export type WeekPlan = { label: string; draftCount: number };

// What the last month of generations cost, per agent. Absent until a Post has
// carried token counts back from Ollama.
export type TokenUsage = {
  planner: number;
  copywriter: number;
  generations: number;
};

const DAY_FOR_PILLAR = ["MON", "WED", "FRI"];

export function ClientDashboard({
  client,
  blockedReason,
  weekPlan,
  weekLabel,
  tokenUsage,
  onGenerate,
  onRegenerate,
}: {
  client: Identity;
  blockedReason: string | null;
  weekPlan: WeekPlan | null;
  // The week the generate button targets, e.g. "Week of Jul 20 – Jul 26".
  weekLabel: string;
  tokenUsage: TokenUsage | null;
  onGenerate: (clientId: string) => Promise<GenerateResult>;
  onRegenerate: (clientId: string) => Promise<GenerateResult>;
}) {
  const [state, setState] = useState<DashboardState>({ kind: "idle" });
  // Regenerate is destructive, so the first click opens this confirmation rather
  // than discarding anything — the same two-step shape the review-flag approval
  // gate uses on the board.
  const [confirming, setConfirming] = useState(false);

  async function run(action: (clientId: string) => Promise<GenerateResult>) {
    if (state.kind === "generating") return; // prevent double-submit
    setState({ kind: "generating" });
    const result = await action(client.id);
    setState(
      result.ok
        ? { kind: "success", posts: result.posts, warnings: result.warnings }
        : { kind: "error", message: result.error },
    );
  }

  const busy = state.kind === "generating";
  const meta = [client.location, client.audience].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-4 font-sans">
      <Card className="flex items-center gap-4">
        <ClinicTile name={client.name} logoUrl={client.logoUrl} size="lg" />

        <div className="min-w-0 flex-1">
          <h1 className="text-heading font-semibold text-text">{client.name}</h1>
          {/* Clamped to two lines: an audience description can run to a
              paragraph, and letting it set the card's height turns the identity
              header into the tallest thing on the page. */}
          {meta ? <p className="line-clamp-2 text-body-lg text-muted">{meta}</p> : null}
        </div>

        {/* Capped, and allowed to shrink. Without both, sentence-length pillars
            size this column to their own width and crush the name block beside
            it into a one-word-per-line ribbon. */}
        <div className="flex min-w-0 max-w-[48%] flex-none flex-col items-end gap-2">
          {client.colors ? (
            <div className="flex items-center gap-1.5">
              <MicroLabel>Brand</MicroLabel>
              <BrandDots colors={client.colors} />
            </div>
          ) : null}
          <div className="flex min-w-0 max-w-full flex-col items-end gap-1">
            {client.pillars.map((pillar, i) => (
              <PillarChip key={i} title={pillar}>
                <span className="flex-none text-label-xs font-extrabold opacity-75">
                  {DAY_FOR_PILLAR[i]}
                </span>
                <span className="truncate">{pillar}</span>
              </PillarChip>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <Card className="flex flex-col gap-3">
          <div>
            <MicroLabel>Generation</MicroLabel>
            <p className="mt-0.5 text-title-lg font-semibold text-text">{weekLabel}</p>
            {/* A week may hold only one Plan, so once this week has one the
                generate affordance is replaced rather than left to be refused —
                and the reason travels with its remedy. Anything that REFUSES or
                REDIRECTS the operator's intent is an alert; "nothing scheduled
                yet" is just a status line. */}
            {blockedReason || weekPlan ? (
              <p role="alert" className="mt-0.5 text-body-lg text-muted">
                {blockedReason ??
                  `This week already has a plan (${weekPlan!.label}). Regenerate replaces its drafts.`}
              </p>
            ) : (
              <p className="mt-0.5 text-body-lg text-muted">Nothing scheduled yet.</p>
            )}
          </div>

          <div className="mt-auto flex items-center gap-3">
            {weekPlan && !blockedReason ? (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                disabled={busy}
                className={BUTTON_PRIMARY}
              >
                {busy ? <Spinner /> : null}
                {busy ? "Regenerating…" : "Regenerate this week"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => run(onGenerate)}
                disabled={busy || blockedReason !== null}
                className={BUTTON_PRIMARY}
              >
                {busy ? <Spinner /> : null}
                {busy ? "Generating…" : "Generate this week"}
              </button>
            )}
            <Link href={`/clients/${client.id}/board`} className={BUTTON_SECONDARY}>
              Board →
            </Link>
          </div>

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

          {busy ? (
            <p role="status" className="text-body-lg text-muted">
              Generating drafts…
            </p>
          ) : null}

          {state.kind === "error" ? (
            <p role="alert" className="text-body-lg text-danger">
              {state.message}
            </p>
          ) : null}

          {state.kind === "success" ? (
            <p className="flex items-center gap-2 rounded-sm border border-success/25 bg-success/[0.09] px-3 py-2 text-body-lg text-text">
              <span aria-hidden="true" className="font-bold text-success">
                ✓
              </span>
              {state.posts.length} draft{state.posts.length === 1 ? "" : "s"} created.
            </p>
          ) : null}
        </Card>

        <TokenPanel usage={tokenUsage} />
      </div>

      {state.kind === "success" ? (
        <DraftList posts={state.posts} warnings={state.warnings} />
      ) : null}
    </div>
  );
}

// The brand swatches. Only the FIRST color reaches `--color-accent` via the
// overlay, so it is painted from `bg-accent` and rebrands for free; any further
// colors are reference values the operator recorded and have no token, so they
// are painted from the stored string. That asymmetry is the point — the swatches
// show what the clinic uses, and the accent shows what the app actually applies.
function BrandDots({ colors }: { colors: string }) {
  const parsed = colors
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

  return (
    <span className="flex items-center gap-1" aria-label={`Brand colors: ${colors}`}>
      {parsed.map((color, i) => (
        <span
          key={i}
          className={`inline-block h-3.5 w-3.5 rounded-pill border border-border ${
            i === 0 ? "bg-accent" : ""
          }`}
          style={i === 0 ? undefined : { background: color }}
        />
      ))}
    </span>
  );
}

// What the last month of generation cost, split by agent. Two bars scaled to
// whichever agent used more, because the interesting comparison is planner
// against copywriter — not either against an absolute budget the app does not
// have (Client.monthlyTokenBudget is deferred to v2, ADR-0002).
function TokenPanel({ usage }: { usage: TokenUsage | null }) {
  return (
    <Card className="flex flex-col gap-3">
      <MicroLabel>Avg tokens per generation</MicroLabel>

      {usage && usage.generations > 0 ? (
        <>
          <p className="text-stat font-bold tabular text-text">
            {(usage.planner + usage.copywriter).toLocaleString()}
            <span className="text-body-lg font-normal tracking-normal text-muted">
              {" "}
              avg · {usage.generations} generation
              {usage.generations === 1 ? "" : "s"}
            </span>
          </p>
          <div className="flex flex-col gap-2">
            <UsageRow
              name="Planner"
              value={usage.planner}
              max={Math.max(usage.planner, usage.copywriter)}
              fill="bg-primary"
            />
            <UsageRow
              name="Copywriter"
              value={usage.copywriter}
              max={Math.max(usage.planner, usage.copywriter)}
              fill="bg-accent"
            />
          </div>
        </>
      ) : (
        <p className="my-auto text-body-lg text-muted">
          No generations yet — the first run will show planner vs. copywriter
          usage here.
        </p>
      )}
    </Card>
  );
}

function UsageRow({
  name,
  value,
  max,
  fill,
}: {
  name: string;
  value: number;
  max: number;
  fill: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="grid grid-cols-[86px_1fr_56px] items-center gap-2 text-body">
      <span className="text-muted">{name}</span>
      <span className="block h-1.5 overflow-hidden rounded-pill bg-surface">
        <span className={`block h-full rounded-pill ${fill}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="tabular text-right text-text">{value.toLocaleString()}</span>
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
      className="flex flex-col gap-3 rounded-sm border border-border bg-surface p-4"
    >
      <p className="text-body-lg text-text">
        Replace {draftCount} {plural} with freshly generated ones?
      </p>
      <p className="text-body-lg text-muted">
        Approved and published posts in this week are kept.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-sm border border-transparent bg-danger px-3.5 py-1.5 text-body-lg font-semibold text-on-primary"
        >
          Replace {draftCount} {plural}
        </button>
        <button type="button" onClick={onCancel} className={BUTTON_SECONDARY}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function DraftList({ posts, warnings }: { posts: DraftPost[]; warnings: string[] }) {
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
              className="rounded-sm border border-warning/35 bg-warning/10 px-3 py-2 text-body-lg text-warning"
            >
              {w}
            </li>
          ))}
        </ul>
      ) : null}
      {posts.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {posts.map((p) => (
            <li
              key={p.id}
              className="rounded border border-border bg-surface-raised px-4 py-3 shadow-sm"
            >
              <p className="text-body-lg font-semibold text-text">{p.topic}</p>
              {/* Each fact in its own element, so a reader (and a test) can
                  address the pillar without matching the whole joined line. */}
              <p className="text-body text-muted">
                <span>{p.pillar}</span>
                <span aria-hidden="true"> · </span>
                <span>{p.format}</span>
                <span aria-hidden="true"> · </span>
                <span>{p.scheduledDate.slice(0, 10)}</span>
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
