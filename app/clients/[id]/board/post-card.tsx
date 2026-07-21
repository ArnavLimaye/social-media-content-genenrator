"use client";

import { useState, useRef, useLayoutEffect } from "react";
import type { SerializedPost, Slide, SlideField, ReviewFlag } from "@/lib/posts";
import { postState } from "@/lib/post-state";
import { canApprove, isEditable, needsAcknowledgment } from "@/lib/post-status";
import { dayLabel } from "@/lib/calendar";
import { formatGlyph, statusBadge } from "./post-badges";

// The Post card — the reusable centrepiece of every Board mode: the kanban
// column (#8), the week-list row, and the editor drawer (#9). Built to the #7
// design lock (docs/design/post-card.md):
// one column, badge row → date line → topic + hook → review flags → slides →
// caption → CTA → hashtags → footer. Every value is a token-derived class
// (ADR-0003); accent-painted elements (pillar badge, image-idea `creative`
// chips, hashtags) read `--color-accent`, so the surrounding <BrandOverlay>
// rebrands them per Client with zero component changes (design-lock §4).
//
// Inline-editable copy fields commit on blur through injected callbacks, and
// #10 made the footer live: the status actions now drive the draft → approved →
// published lifecycle, with the review-flag acknowledgment gate on the first
// step. The page wires real server actions; tests inject fakes.

export type PostCardProps = {
  post: SerializedPost;
  onEditField: (postId: string, field: "hook" | "caption" | "cta", value: string) => void;
  onEditHashtags: (postId: string, hashtags: string[]) => void;
  onEditSlide: (
    postId: string,
    slideIndex: number,
    field: SlideField,
    value: string,
  ) => void;
  // Lifecycle actions (#10). `acknowledged` is the operator's explicit sign-off
  // on the review flags — the card never sends it unless the operator ticked it.
  onApprove?: (postId: string, acknowledged: boolean) => void;
  onPublish?: (postId: string) => void;
  // The date line is kanban-only (design-lock §2): there, a card carries no
  // other clue when it is scheduled. In the calendar modes the position on the
  // calendar *is* the date, and repeating it under the day heading reads as two
  // different facts about the same Post.
  showDateLine?: boolean;
};

// The card shell (design-lock §1). A generation-failed Post gets a dashed
// `danger` border so it reads as an incomplete slot rather than an error —
// the copy is missing, and the operator is meant to regenerate it (#11).
// A `published` Post is visibly recessed — its background mixed 45% toward
// `surface` — so a read-only record reads as settled rather than merely
// un-clickable (design-lock §1).
const SHELL_BASE = "flex flex-col gap-3 rounded p-5 shadow-sm border";
const SHELL_FAILED = "bg-surface-raised border-dashed border-danger/45 bg-danger/5";

function shellClass(state: string): string {
  if (state === "failed") return `${SHELL_BASE} ${SHELL_FAILED}`;
  return `${SHELL_BASE} border-border ${state === "published" ? "" : "bg-surface-raised"}`;
}

// The recessed `published` background: `surface-raised` mixed 45% toward
// `surface`. Expressed as a `color-mix` over the two tokens rather than a new
// token, so it still moves with the theme (ADR-0003) — the same technique the
// review-flag border already uses.
const PUBLISHED_BG = {
  backgroundColor:
    "color-mix(in srgb, var(--color-surface) 45%, var(--color-surface-raised))",
};

export function PostCard({
  post,
  onEditField,
  onEditHashtags,
  onEditSlide,
  onApprove,
  onPublish,
  showDateLine = true,
}: PostCardProps) {
  // Not `post.status`: a Post whose copywriter call failed is stored as a
  // topic-only draft, so the failed state has to be derived (lib/posts.ts).
  const state = postState(post);
  const status = statusBadge(state);
  // A published Post is the record of what went out; every field renders as
  // static text in every Board view (design-lock §1).
  const readOnly = !isEditable(post.status);

  return (
    <article
      className={shellClass(state)}
      style={state === "published" ? PUBLISHED_BG : undefined}
    >
      {/* badge row */}
      <div className="flex items-center gap-2">
        <span className="rounded-pill border border-border px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-muted">
          <span aria-hidden="true">{formatGlyph(post.format)}</span>{" "}
          {post.format}
        </span>
        <span className="rounded-pill bg-accent/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-accent">
          {post.pillar}
        </span>
        <span className="flex-1" />
        <span
          className={`rounded-pill border px-2 py-0.5 text-xs font-bold uppercase tracking-wider ${status.cls}`}
        >
          {status.label}
        </span>
      </div>

      {/* date line (kanban only — design-lock §2) */}
      {showDateLine && post.scheduledDate ? <DateLine iso={post.scheduledDate} /> : null}

      {/* topic + hook */}
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold text-text">{post.topic}</h3>
        <InlineText
          ariaLabel={`Hook — ${post.topic}`}
          value={post.hook ?? ""}
          readOnly={readOnly}
          onCommit={(v) => onEditField(post.id, "hook", v)}
          className="text-sm italic text-muted"
        />
      </div>

      {/* review flags — only when present (design-lock §3) */}
      {post.reviewFlags && post.reviewFlags.length > 0 ? (
        <ReviewFlags flags={post.reviewFlags} reviewed={!!post.flagsAcknowledgedAt} />
      ) : null}

      {/* slides */}
      {post.slides && post.slides.length > 0 ? (
        <SlideList
          slides={post.slides}
          topic={post.topic}
          readOnly={readOnly}
          onEditSlide={(index, field, value) => onEditSlide(post.id, index, field, value)}
        />
      ) : null}

      {/* caption */}
      <Section label="Caption">
        <InlineText
          ariaLabel={`Caption — ${post.topic}`}
          value={post.caption ?? ""}
          multiline
          readOnly={readOnly}
          onCommit={(v) => onEditField(post.id, "caption", v)}
          className="text-sm text-text"
        />
      </Section>

      {/* CTA */}
      <Section label="CTA">
        <InlineText
          ariaLabel={`CTA — ${post.topic}`}
          value={post.cta ?? ""}
          readOnly={readOnly}
          onCommit={(v) => onEditField(post.id, "cta", v)}
          className="text-sm font-semibold text-text"
        />
      </Section>

      {/* hashtags */}
      {post.hashtags && post.hashtags.length > 0 ? (
        <InlineHashtags
          hashtags={post.hashtags}
          topic={post.topic}
          readOnly={readOnly}
          onCommit={(tags) => onEditHashtags(post.id, tags)}
        />
      ) : null}

      {/* footer — live lifecycle actions (#10) */}
      <Footer post={post} state={state} onApprove={onApprove} onPublish={onPublish} />
    </article>
  );
}

// The kanban date line: "Wed · Jul 22" — the same label the week list puts on
// its day headings, from the same helper, so a Post cannot appear to be on one
// day in one mode and another day elsewhere. UTC throughout (lib/calendar.ts).
function DateLine({ iso }: { iso: string }) {
  return (
    <p className="text-xs font-medium text-muted">{dayLabel(new Date(iso))}</p>
  );
}

// A section with the locked 9.5px/800 uppercase label (design-lock §2).
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[9.5px] font-extrabold uppercase tracking-widest text-muted">
        {label}
      </span>
      {children}
    </div>
  );
}

// Slides: a `16px 1fr` grid, each block inset on `surface` (design-lock §2).
function SlideList({
  slides,
  topic,
  readOnly,
  onEditSlide,
}: {
  slides: Slide[];
  topic: string;
  readOnly: boolean;
  onEditSlide: (index: number, field: SlideField, value: string) => void;
}) {
  return (
    <ol className="flex flex-col gap-2">
      {slides.map((slide, i) => (
        <li
          key={i}
          className="grid grid-cols-[16px_1fr] gap-2 rounded-sm bg-surface p-3"
        >
          <span className="text-sm text-muted">{i + 1}</span>
          <div className="flex flex-col gap-1">
            <InlineText
              ariaLabel={`Slide ${i + 1} heading — ${topic}`}
              value={slide.heading}
              readOnly={readOnly}
              onCommit={(v) => onEditSlide(i, "heading", v)}
              className="text-sm font-semibold text-text"
            />
            <InlineText
              ariaLabel={`Slide ${i + 1} description — ${topic}`}
              value={slide.description}
              multiline
              readOnly={readOnly}
              onCommit={(v) => onEditSlide(i, "description", v)}
              className="text-sm text-muted"
            />
            <AssetPrompt
              prompt={slide.imagePrompt}
              label={`Slide ${i + 1} asset prompt — ${topic}`}
              readOnly={readOnly}
              onCommit={(v) => onEditSlide(i, "imagePrompt", v)}
            />
            <ImageIdeaChips ideas={slide.imageIdeas} />
          </div>
        </li>
      ))}
    </ol>
  );
}

// The slide's primary asset prompt: what the operator pastes into Flow /
// ChatGPT / Midjourney to get this exact slide. Given top billing above the
// alternates and editable inline, because it is the field most likely to need
// a tweak (a clinic name spelled right, a colour swapped) before it is used.
//
// Slides generated before `imagePrompt` existed have none. That renders as an
// explicit note rather than an empty gap — silence would read as "this slide
// needs no asset", which is never true.
function AssetPrompt({
  prompt,
  label,
  readOnly,
  onCommit,
}: {
  prompt: string | undefined;
  label: string;
  readOnly: boolean;
  onCommit: (value: string) => void;
}) {
  if (!prompt) {
    return (
      <p className="text-xs italic text-muted">
        No asset prompt — regenerate this post to get one.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1 rounded-sm border border-accent/40 bg-accent/5 p-2">
      <div className="flex items-center gap-2">
        <span className="rounded-pill bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-on-accent">
          asset prompt
        </span>
        <CopyIdeaButton idea={prompt} label={label} />
      </div>
      <InlineText
        ariaLabel={label}
        value={prompt}
        multiline
        readOnly={readOnly}
        onCommit={onCommit}
        className="text-xs leading-snug text-text"
      />
    </div>
  );
}

// Image-idea chips encode type by color AND repeat the kind as uppercase text
// inside, so the distinction is never color-only (design-lock §2). These are
// ALTERNATE directions — the primary is the asset prompt above.
//
// The brief itself is rendered beside the chip, not hidden behind it. These are
// paste-ready image-tool prompts (a full generation prompt for `creative`, a
// shot brief for `photo`), so a card showing only the word "creative" tells the
// operator nothing they can act on — the text IS the deliverable. Each carries
// a copy button because pasting it into an image tool is the whole workflow.
function ImageIdeaChips({ ideas }: { ideas: Slide["imageIdeas"] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {ideas.map((idea, i) => (
        <li key={i} className="flex items-start gap-1.5">
          <span
            className={
              idea.type === "creative"
                ? "shrink-0 rounded-pill border border-accent bg-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent"
                : "shrink-0 rounded-pill border border-border bg-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted"
            }
          >
            {idea.type}
          </span>
          <span className="text-xs leading-snug text-muted">{idea.idea}</span>
          <CopyIdeaButton idea={idea.idea} />
        </li>
      ))}
    </ul>
  );
}

// Copy state is per-button and self-clearing. Clipboard access can reject
// (insecure context, denied permission); the button says so rather than
// silently claiming success the operator would only catch on paste.
function CopyIdeaButton({ idea, label }: { idea: string; label?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(idea);
      setState("copied");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 2000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label ? `Copy ${label}` : `Copy image idea: ${idea}`}
      className="ml-auto shrink-0 rounded-pill border border-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted hover:text-text"
    >
      {state === "copied" ? "copied" : state === "failed" ? "failed" : "copy"}
    </button>
  );
}

// Once acknowledged the badge switches from "⚑ n flags" to "⚑ n reviewed"
// (design-lock §3) — it does not disappear. The claims are still worth seeing,
// and the operator must be able to re-read what was signed off on. The wording
// says a human looked, never that the claim is true.
function ReviewFlags({ flags, reviewed }: { flags: ReviewFlag[]; reviewed: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="self-start rounded-pill border bg-warning/10 px-2 py-0.5 text-xs font-bold text-warning"
        style={{ borderColor: "color-mix(in srgb, var(--color-warning) 35%, transparent)" }}
      >
        ⚑ {flags.length} {reviewed ? "reviewed" : "flags"} {open ? "▲" : "▼"}
      </button>
      {open ? (
        <ul className="flex flex-col gap-1 rounded-sm bg-warning/5 p-3">
          {flags.map((flag, i) => (
            <li key={i} className="text-sm text-text">
              <span className="font-semibold">"{flag.claim}"</span>
              <span aria-hidden="true"> → </span>
              <span className="text-muted">{flag.reason}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// Hashtags, accent-colored (design-lock §2), inline-editable as one text field
// whose value is the hashtags joined by spaces; committed text is split on
// whitespace back into the array.
function InlineHashtags({
  hashtags,
  topic,
  readOnly,
  onCommit,
}: {
  hashtags: string[];
  topic: string;
  readOnly: boolean;
  onCommit: (hashtags: string[]) => void;
}) {
  const joined = hashtags.join(" ");
  const [value, setValue] = useState(joined);
  if (readOnly) {
    return <p className="px-1 text-sm font-semibold text-accent">{joined}</p>;
  }
  return (
    <input
      type="text"
      aria-label={`Hashtags — ${topic}`}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        // skip a spurious write when nothing changed
        if (value === joined) return;
        const next = value.split(/\s+/).filter(Boolean);
        onCommit(next);
      }}
      className="-ml-1 rounded-sm bg-transparent px-1 text-sm font-semibold text-accent outline-none hover:bg-surface focus:bg-surface focus:outline focus:outline-1 focus:outline-accent"
    />
  );
}

// The shared inline-edit affordance: borderless, revealing a `border` outline
// on hover and an `accent` outline with a `surface` fill on focus, occupying
// the same box as static text — no layout shift between reading and editing
// (design-lock §2). An edit commits on blur; an unchanged field commits nothing.
const INLINE_FIELD_CLASS =
  "-ml-1 w-full rounded-sm bg-transparent px-1 outline-none hover:outline hover:outline-1 hover:outline-border focus:bg-surface focus:outline focus:outline-1 focus:outline-accent";

function InlineText({
  ariaLabel,
  value,
  onCommit,
  className = "",
  multiline = false,
  readOnly = false,
}: {
  ariaLabel: string;
  value: string;
  onCommit: (value: string) => void;
  className?: string;
  multiline?: boolean;
  readOnly?: boolean;
}) {
  const [text, setText] = useState(value);

  // A published Post renders its copy as plain text, not a disabled field: the
  // record stays fully readable, and there is no affordance suggesting an edit
  // that would be refused (design-lock §1; the data layer refuses it too).
  if (readOnly) {
    return <p className={`whitespace-pre-wrap px-1 ${className}`}>{value}</p>;
  }

  // skip a spurious write when the field was not changed
  const commit = () => {
    if (text === value) return;
    onCommit(text);
  };

  if (multiline) {
    return (
      <AutoTextarea
        ariaLabel={ariaLabel}
        text={text}
        onChange={setText}
        onCommit={commit}
        className={className}
      />
    );
  }

  return (
    <input
      type="text"
      aria-label={ariaLabel}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      className={`${INLINE_FIELD_CLASS} ${className}`}
    />
  );
}

// A textarea that grows to fit its content, so multi-paragraph copy is never
// visually truncated (design-lock §2, amended on #8). Two mechanisms, because
// each covers what the other cannot:
//
//   - `rows`, derived from the text, gives a correct height on first paint and
//     during server rendering, before any effect runs.
//   - a layout effect measuring `scrollHeight` handles real wrapping, which
//     depends on the rendered width and cannot be computed from the string.
//
// `resize-none` because the height is managed here; overflow is hidden so no
// scrollbar flashes while the height is being set.
const TEXTAREA_MAX_ROWS = 14;

function estimateRows(text: string): number {
  // A first approximation from the text alone: explicit newlines, plus a rough
  // allowance for long lines that will wrap. The layout effect corrects this to
  // the measured height once the field has been laid out.
  const lines = text.split("\n");
  const rows = lines.reduce((acc, line) => acc + Math.max(1, Math.ceil(line.length / 60)), 0);
  return Math.min(Math.max(rows, 1), TEXTAREA_MAX_ROWS);
}

function AutoTextarea({
  ariaLabel,
  text,
  onChange,
  onCommit,
  className,
}: {
  ariaLabel: string;
  text: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  className: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // measure from a collapsed height, or scrollHeight only ever grows
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  return (
    <textarea
      ref={ref}
      aria-label={ariaLabel}
      value={text}
      rows={estimateRows(text)}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      className={`${INLINE_FIELD_CLASS} resize-none overflow-hidden ${className}`}
    />
  );
}

// Footer: status note left, lifecycle actions right (design-lock §2). The
// action set is derived, never guessed — `canApprove` decides whether Approve
// appears at all, so the footer and the data layer cannot disagree about what
// is legal.
const NOTES: Record<string, string> = {
  draft: "Ready for review",
  approved: "Queued",
  published: "Published · read-only",
  failed: "Planner outline saved · copy failed",
};

const ACTION_CLASS =
  "rounded-sm border border-border px-2 py-0.5 font-semibold text-text hover:bg-surface";

function Footer({
  post,
  state,
  onApprove,
  onPublish,
}: {
  post: SerializedPost;
  state: string;
  onApprove?: (postId: string, acknowledged: boolean) => void;
  onPublish?: (postId: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);

  const gated = needsAcknowledgment(post);
  const showApprove = canApprove(post, true) && onApprove;
  const showPublish = state === "approved" && onPublish;

  // A flagged Post cannot be clicked past: the first click opens the
  // confirmation rather than approving. Clean copy goes straight through.
  const approve = () => {
    if (gated) return setConfirming(true);
    onApprove?.(post.id, false);
  };

  // The footer note tracks the same three-way flag state as the badge
  // (design-lock §2 table): unreviewed → reviewed → the plain lifecycle note.
  const acknowledged = state === "draft" && !!post.flagsAcknowledgedAt;
  const note = gated
    ? "Review flags before approving"
    : acknowledged
      ? "Flags reviewed"
      : NOTES[state] ?? NOTES.draft;

  return (
    <>
      <footer className="flex items-center justify-between border-t border-border pt-3 text-xs text-muted">
        <span className={state === "published" ? "font-semibold text-success" : ""}>
          {note}
        </span>
        <span className="flex gap-1">
          {showApprove ? (
            <button type="button" onClick={approve} className={ACTION_CLASS}>
              {/* the ellipsis signals a further step (design-lock §3) */}
              {gated ? "Approve…" : "Approve"}
            </button>
          ) : null}
          {showPublish ? (
            <button
              type="button"
              onClick={() => onPublish?.(post.id)}
              className={ACTION_CLASS}
            >
              Publish
            </button>
          ) : null}
          {state === "failed" ? (
            <span aria-hidden="true" className="rounded-sm border border-border px-2 py-0.5">
              ↻ Regenerate
            </span>
          ) : null}
        </span>
      </footer>

      {confirming ? (
        <ApprovalConfirm
          flags={post.reviewFlags ?? []}
          topic={post.topic}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            onApprove?.(post.id, true);
          }}
        />
      ) : null}
    </>
  );
}

// The acknowledgment gate (design-lock §3). There is no fact-check agent in v1,
// so this dialog *is* the medical-accuracy safeguard — which is why confirming
// is deliberately two deliberate acts, a tick and a click, rather than one
// button that can be clicked past on reflex.
//
// The wording acknowledges that a human looked. It never says the claims are
// correct, because acknowledging does not make them so.
// Rendered inline beneath the card rather than as an overlay: the flags belong
// to *this* Post, and in a kanban column the surrounding card is the context
// that makes them legible. Deliberately no `aria-modal` — it does not trap
// focus or inert the page, and claiming otherwise would misdescribe it.
function ApprovalConfirm({
  flags,
  topic,
  onCancel,
  onConfirm,
}: {
  flags: ReviewFlag[];
  topic: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <div
      role="dialog"
      aria-label={`Review flags before approving — ${topic}`}
      className="mt-2 flex flex-col gap-3 rounded-sm border border-warning/35 bg-warning/5 p-4"
    >
      <p className="text-sm font-semibold text-text">
        This post has {flags.length} claim{flags.length === 1 ? "" : "s"} flagged for
        review.
      </p>

      {/* every claim with its reason — a claim alone gives nothing to act on */}
      <ul className="flex flex-col gap-2">
        {flags.map((flag, i) => (
          <li key={i} className="text-sm text-text">
            <span className="font-semibold">&ldquo;{flag.claim}&rdquo;</span>
            <span aria-hidden="true"> → </span>
            <span className="text-muted">{flag.reason}</span>
          </li>
        ))}
      </ul>

      <label className="flex items-start gap-2 text-sm text-text">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="mt-0.5 accent-accent"
        />
        <span>
          I&rsquo;ve reviewed these claims and take responsibility for approving them.
        </span>
      </label>

      <div className="flex justify-end gap-2 text-xs">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-sm px-3 py-1 font-semibold text-muted hover:bg-surface hover:text-text"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!acknowledged}
          onClick={onConfirm}
          className="rounded-sm bg-accent px-3 py-1 font-semibold text-on-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          I&rsquo;ve reviewed these — approve
        </button>
      </div>
    </div>
  );
}
