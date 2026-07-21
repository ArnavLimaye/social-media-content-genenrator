"use client";

import { useState, useRef, useLayoutEffect } from "react";
import type { SerializedPost, Slide, SlideField, ReviewFlag } from "@/lib/posts";
import { postState } from "@/lib/post-state";
import { canApprove, isEditable, needsAcknowledgment } from "@/lib/post-status";
import { cellLabel, dayLabel } from "@/lib/calendar";
import { Badge, OutlineBadge, PillarChip, SectionLabel } from "@/app/ui";
import { formatGlyph, statusBadge } from "./post-badges";

// The Post card — the reusable centrepiece of every Board mode: the kanban
// column, the week-list row, and the editor drawer. Built to the Content
// Back-Office design:
//
//   badge row → date line → topic + hook → review flags → slides →
//   caption → CTA → hashtags → footer
//
// The card shell carries NO padding of its own. Each band pads itself instead,
// because the footer's top rule has to run edge to edge — an outer padding
// would inset it and turn a structural division into a floating line. The shell
// clips (`overflow-hidden`) so the bands cannot overrun its rounded corners.
//
// Every value is a token-derived class (ADR-0003); accent-painted elements (the
// pillar chip, `creative` image-idea chips, hashtags) read `--color-accent`, so
// the surrounding <BrandOverlay> rebrands them per Client with zero component
// changes.

// The card appears at three sizes, and the design scales the title and adjusts
// what the header carries at each. Which chrome is redundant depends on the
// surroundings, not on preference:
//
//   kanban — a card floats free, so it must state its own date and pillar.
//   week   — the day gutter beside it already names both. Repeating them reads
//            as two different facts about the same Post.
//   drawer — the drawer's own header bar states the date and status.
export type PostCardVariant = "kanban" | "week" | "drawer";

const VARIANT = {
  kanban: { title: "text-title-sm", dateLine: true, pillar: true, editTopic: false },
  week: { title: "text-title", dateLine: false, pillar: false, editTopic: true },
  drawer: { title: "text-title-lg", dateLine: false, pillar: true, editTopic: true },
} as const;

export type PostCardProps = {
  post: SerializedPost;
  onEditField: (postId: string, field: "hook" | "caption" | "cta" | "topic", value: string) => void;
  onEditHashtags: (postId: string, hashtags: string[]) => void;
  onEditSlide: (
    postId: string,
    slideIndex: number,
    field: SlideField,
    value: string,
  ) => void;
  // Lifecycle actions. `acknowledged` is the operator's explicit sign-off on the
  // review flags — the card never sends it unless the operator ticked it.
  onApprove?: (postId: string, acknowledged: boolean) => void;
  onPublish?: (postId: string) => void;
  variant?: PostCardVariant;
};

// The card shell. A generation-failed Post gets a dashed `danger` border so it
// reads as an incomplete slot rather than an error — the copy is missing, and
// the operator is meant to regenerate it. A `published` Post is visibly
// recessed, its background mixed 45% toward `surface`, so a read-only record
// reads as settled rather than merely un-clickable.
const SHELL_BASE = "flex flex-col overflow-hidden rounded shadow-sm border";

function shellClass(state: string): string {
  if (state === "failed") return `${SHELL_BASE} border-dashed border-danger/45 bg-danger/5`;
  return `${SHELL_BASE} border-border bg-surface-raised`;
}

// The recessed `published` background: `surface-raised` mixed 45% toward
// `surface`. Expressed as a `color-mix` over the two tokens rather than as a new
// token, so it still moves with the theme (ADR-0003).
const PUBLISHED_BG = {
  backgroundColor:
    "color-mix(in srgb, var(--color-surface) 45%, var(--color-surface-raised))",
};

// The three padding bands. Deliberately named, because the numbers are not
// arbitrary: the header sits tight under the card edge, the body hangs off it,
// and the footer is symmetrical around its rule.
// The header does NOT wrap. The design wraps it, assuming short pillar names,
// but a real pillar can be a whole sentence — and a wrapping header pushes the
// status badge onto its own line while the pillar chip runs past the card edge.
// Instead the format and status badges hold their size and the pillar chip
// absorbs whatever is left, truncating.
const BAND_HEADER = "flex items-center gap-1.5 px-3 pt-3";
const BAND_BODY = "flex flex-col gap-3 px-3 pb-3 pt-2";

export function PostCard({
  post,
  onEditField,
  onEditHashtags,
  onEditSlide,
  onApprove,
  onPublish,
  variant = "kanban",
}: PostCardProps) {
  // Not `post.status`: a Post whose copywriter call failed is stored as a
  // topic-only draft, so the failed state has to be derived (lib/posts.ts).
  const state = postState(post);
  const status = statusBadge(state);
  const v = VARIANT[variant];
  // A published Post is the record of what went out; every field renders as
  // static text in every Board view.
  const readOnly = !isEditable(post.status);

  return (
    <article
      className={shellClass(state)}
      style={state === "published" ? PUBLISHED_BG : undefined}
    >
      <div className={BAND_HEADER}>
        <OutlineBadge>
          <span aria-hidden="true">{formatGlyph(post.format)}</span>
          {post.format}
        </OutlineBadge>
        {v.pillar ? (
          <PillarChip title={post.pillar}>
            <span className="truncate">{post.pillar}</span>
          </PillarChip>
        ) : null}
        <span className="min-w-0 flex-1" />
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>

      {v.dateLine && post.scheduledDate ? (
        <p className="px-3 pt-1 text-body-xs text-muted">
          {dayLabel(new Date(post.scheduledDate))}
        </p>
      ) : null}

      {state === "failed" ? (
        <FailedBody post={post} titleClass={v.title} />
      ) : (
        <div className={BAND_BODY}>
          <div>
            {/* Multiline, where the design uses a single-line input: generated
                topics are a full sentence and routinely outrun the card, and an
                input SCROLLS its overflow instead of wrapping — leaving the
                operator editing a title they cannot read the end of. */}
            <InlineText
              ariaLabel={`Topic — ${post.topic}`}
              value={post.topic}
              multiline
              readOnly={readOnly || !v.editTopic}
              onCommit={(val) => onEditField(post.id, "topic", val)}
              className={`${v.title} font-semibold text-text`}
            />
            <InlineText
              ariaLabel={`Hook — ${post.topic}`}
              value={post.hook ?? ""}
              multiline
              readOnly={readOnly}
              onCommit={(val) => onEditField(post.id, "hook", val)}
              className="text-body-lg text-muted"
            />
          </div>

          {post.reviewFlags && post.reviewFlags.length > 0 ? (
            <ReviewFlags flags={post.reviewFlags} reviewed={!!post.flagsAcknowledgedAt} />
          ) : null}

          {post.slides && post.slides.length > 0 ? (
            <SlideList
              slides={post.slides}
              topic={post.topic}
              readOnly={readOnly}
              onEditSlide={(index, field, value) => onEditSlide(post.id, index, field, value)}
            />
          ) : null}

          <Section label="Caption">
            <InlineText
              ariaLabel={`Caption — ${post.topic}`}
              value={post.caption ?? ""}
              multiline
              readOnly={readOnly}
              onCommit={(val) => onEditField(post.id, "caption", val)}
              className="text-body-lg text-text"
            />
          </Section>

          <Section label="CTA">
            <InlineText
              ariaLabel={`CTA — ${post.topic}`}
              value={post.cta ?? ""}
              readOnly={readOnly}
              onCommit={(val) => onEditField(post.id, "cta", val)}
              className="text-body-lg text-text"
            />
          </Section>

          {post.hashtags && post.hashtags.length > 0 ? (
            <InlineHashtags
              hashtags={post.hashtags}
              topic={post.topic}
              readOnly={readOnly}
              onCommit={(tags) => onEditHashtags(post.id, tags)}
            />
          ) : null}
        </div>
      )}

      <Footer post={post} state={state} onApprove={onApprove} onPublish={onPublish} />
    </article>
  );
}

// A failed Post has a planner topic and nothing else. It says so in words
// rather than rendering a row of empty fields, which would read as copy that
// exists but is blank.
function FailedBody({ post, titleClass }: { post: SerializedPost; titleClass: string }) {
  return (
    <div className="flex flex-col gap-1.5 px-3 pb-3 pt-2">
      <p className={`${titleClass} font-semibold text-muted`}>{post.topic}</p>
      <p className="text-body-lg font-semibold text-danger">
        Generation failed — no copy was produced.
      </p>
      <p className="text-body text-muted">The planner outline was saved.</p>
    </div>
  );
}

// A labelled band inside the card body.
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <SectionLabel>{label}</SectionLabel>
      {children}
    </div>
  );
}

// Slides: a `16px 1fr` grid, each block inset on `surface` so the slide stack
// reads as content the card contains rather than more card.
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
          className="grid grid-cols-[16px_1fr] gap-2 rounded-sm bg-surface p-2"
        >
          <span className="pt-px text-body-xs font-bold text-muted">{i + 1}</span>
          <div className="min-w-0">
            <InlineText
              ariaLabel={`Slide ${i + 1} heading — ${topic}`}
              value={slide.heading}
              readOnly={readOnly}
              onCommit={(v) => onEditSlide(i, "heading", v)}
              className="text-body-lg font-semibold text-text"
            />
            <InlineText
              ariaLabel={`Slide ${i + 1} description — ${topic}`}
              value={slide.description}
              multiline
              readOnly={readOnly}
              onCommit={(v) => onEditSlide(i, "description", v)}
              className="text-body text-muted"
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

// The slide's primary asset prompt: what the operator pastes into an image tool
// to get this exact slide. Given top billing above the alternate directions and
// editable inline, because it is the field most likely to need a tweak (a clinic
// name spelled right, a colour swapped) before it is used — and it carries the
// copy button, because pasting it out is the whole workflow.
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
      <p className="mt-1 text-body-sm italic text-muted">
        No asset prompt — regenerate this post to get one.
      </p>
    );
  }
  return (
    <div className="mt-1 flex flex-col gap-1 rounded-sm border border-accent/35 bg-accent/[0.08] p-2">
      <div className="flex items-center gap-2">
        <span className="text-label-xs font-extrabold uppercase text-accent opacity-75">
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
        className="text-body-sm text-text"
      />
    </div>
  );
}

// Image-idea chips: the ALTERNATE directions for a slide. Each is one chip
// carrying its kind and the brief together — the brief IS the deliverable, so a
// chip reading only "creative" would tell the operator nothing they can act on.
//
// `creative` is accent-tinted and `photo` is neutral, but the kind is also
// spelled out inside the chip, so the distinction is never color-only.
//
// Each chip carries a copy button, which the design's chips do not. Kept
// because these briefs are paste-ready image-tool prompts and getting one into
// the tool is the entire point of showing it — a chip you have to retype by
// hand is decoration. It sits inside the chip so the row still reads as the
// design's compact wrap of chips rather than a list with a control column.
//
// Stacked full-width rather than wrapped inline, which is where this departs
// from the design: the design's briefs are three words ("perio chart close-up")
// and tile neatly, but a real generated brief is a sentence or two. Wrapped,
// those collapse into tall narrow columns a few words wide. One brief per row
// keeps the line length readable.
// The kind label and the copy button share a header line with the brief
// beneath, rather than all three sitting inline. Inline, the label and button
// eat ~110px of a ~300px kanban column and squeeze the brief — the part that
// actually matters — into a four-word ribbon. It also makes a chip read like
// the asset-prompt block directly above it, which is the same idea at a
// different priority.
const CHIP_BASE =
  "flex w-full flex-col gap-0.5 rounded-sm border px-2 py-1 text-body-sm";

function ImageIdeaChips({ ideas }: { ideas: Slide["imageIdeas"] }) {
  return (
    <ul className="mt-1 flex flex-col gap-1">
      {ideas.map((idea, i) => (
        <li
          key={i}
          className={
            idea.type === "creative"
              ? `${CHIP_BASE} border-accent/35 bg-accent/[0.08] text-accent`
              : `${CHIP_BASE} border-border bg-surface text-muted`
          }
        >
          <span className="flex items-center gap-2">
            <span className="whitespace-nowrap text-label-xs font-extrabold uppercase opacity-75">
              {idea.type}
            </span>
            <CopyIdeaButton idea={idea.idea} />
          </span>
          <span className="min-w-0">{idea.idea}</span>
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
      className="ml-auto shrink-0 self-start rounded-pill border border-border bg-surface-raised px-1.5 text-label-xs font-bold uppercase text-muted hover:text-text"
    >
      {state === "copied" ? "copied" : state === "failed" ? "failed" : "copy"}
    </button>
  );
}

// Once acknowledged the badge switches from "⚑ n flags" to "⚑ n reviewed" — it
// does not disappear. The claims are still worth seeing, and the operator must
// be able to re-read what was signed off on. The wording says a human looked,
// never that the claim is true.
function ReviewFlags({ flags, reviewed }: { flags: ReviewFlag[]; reviewed: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border border-warning/35 bg-warning/10 px-2.5 py-1 text-body font-semibold text-warning"
      >
        ⚑ {flags.length} {reviewed ? "reviewed" : flags.length === 1 ? "flag" : "flags"}
        <span aria-hidden="true" className="text-label-xs">
          {open ? "▲" : "▼"}
        </span>
      </button>
      {open ? (
        <ul className="mt-2 flex flex-col gap-2 rounded-sm border border-warning/25 bg-warning/[0.06] p-3">
          {flags.map((flag, i) => (
            <li key={i} className="text-body text-text">
              <span className="font-semibold">&ldquo;{flag.claim}&rdquo;</span>
              <span aria-hidden="true"> → </span>
              <span className="text-muted">{flag.reason}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// Hashtags, accent-colored, inline-editable as one text field whose value is
// the hashtags joined by spaces; committed text is split on whitespace back
// into the array.
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
    return <p className="text-body text-accent">{joined}</p>;
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
        onCommit(value.split(/\s+/).filter(Boolean));
      }}
      className={`${INLINE_FIELD_CLASS} text-body text-accent`}
    />
  );
}

// The shared inline-edit affordance: borderless, revealing a `border` outline
// on hover and an `accent` outline with a `surface` fill on focus, occupying the
// same box as static text — no layout shift between reading and editing. The
// negative margin cancels the padding so the text sits on the same left edge
// whether it is a field or a paragraph. An edit commits on blur; an unchanged
// field commits nothing.
const INLINE_FIELD_CLASS =
  "-ml-1.5 block w-full rounded-sm border border-transparent bg-transparent px-1.5 py-0.5 hover:border-border focus:border-accent focus:bg-surface focus:outline-none";

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

  // A read-only field renders as plain text, not a disabled input: the record
  // stays fully readable, and there is no affordance suggesting an edit that
  // would be refused (the data layer refuses it too).
  if (readOnly) {
    return <p className={`whitespace-pre-wrap px-1.5 py-0.5 ${className}`}>{value}</p>;
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
// visually truncated. Two mechanisms, because each covers what the other cannot:
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

// Footer: status note left, lifecycle actions right, above a full-bleed rule.
// The action set is derived, never guessed — `canApprove` decides whether
// Approve appears at all, so the footer and the data layer cannot disagree
// about what is legal.
//
// The note states the DATE for a scheduled or published Post, because "Queued"
// alone does not answer the question the operator actually has.
function footerNote(post: SerializedPost, state: string, gated: boolean): string {
  if (state === "failed") return "Planner outline saved · copy failed";
  const when = post.scheduledDate ? cellLabel(new Date(post.scheduledDate)) : null;
  if (state === "published") {
    return when ? `Published ${when} · read-only` : "Published · read-only";
  }
  if (state === "approved") return when ? `Queued — publishes ${when}` : "Queued";
  if (gated) return "Review flags before approving";
  if (post.flagsAcknowledgedAt) return "Flags reviewed";
  return "Ready for review";
}

const ACTION_PRIMARY =
  "rounded-sm border border-transparent bg-primary px-3.5 py-1.5 text-body-lg font-semibold text-on-primary";
const ACTION_SECONDARY =
  "rounded-sm border border-border bg-surface-raised px-3.5 py-1.5 text-body-lg font-semibold text-text hover:border-accent";

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

  return (
    <>
      <footer className="flex items-center gap-2 border-t border-border px-3 py-2">
        <span
          className={
            state === "published"
              ? "text-body-sm font-semibold text-success"
              : "text-body-sm text-muted"
          }
        >
          {footerNote(post, state, gated)}
        </span>
        <span className="flex-1" />
        {showApprove ? (
          <button type="button" onClick={approve} className={ACTION_PRIMARY}>
            {/* the ellipsis signals a further step */}
            {gated ? "Approve…" : "Approve"}
          </button>
        ) : null}
        {showPublish ? (
          <button
            type="button"
            onClick={() => onPublish?.(post.id)}
            className={ACTION_SECONDARY}
          >
            Publish
          </button>
        ) : null}
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

// The acknowledgment gate. There is no fact-check agent in v1, so this dialog
// *is* the medical-accuracy safeguard — which is why confirming is deliberately
// two acts, a tick and a click, rather than one button that can be clicked past
// on reflex.
//
// The wording acknowledges that a human looked. It never says the claims are
// correct, because acknowledging does not make them so.
//
// Rendered as a centred modal over a scrim, per the design: the decision is
// consequential enough that it should take the screen rather than sit inside
// the card as one more thing to scroll past.
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
      className="animate-fade-in fixed inset-0 z-[60] flex items-center justify-center p-5"
      // The scrim is the page's own text color at 38% — it darkens in light mode
      // and stays neutral in dark, which a fixed black cannot do.
      style={{ background: "color-mix(in srgb, var(--color-text) 38%, transparent)" }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Review flags before approving — ${topic}`}
        className="flex w-[520px] max-w-full flex-col gap-4 rounded border border-border bg-surface-raised p-5 shadow-md"
      >
        <div>
          <p className="text-heading-sm font-bold text-text">Approve a flagged post?</p>
          <p className="mt-1 text-body-lg text-muted">
            &ldquo;{topic}&rdquo; has {flags.length} unresolved claim
            {flags.length === 1 ? "" : "s"}. Approving schedules it as-is.
          </p>
        </div>

        {/* every claim with its reason — a claim alone gives nothing to act on */}
        <ul className="flex flex-col gap-2">
          {flags.map((flag, i) => (
            <li
              key={i}
              className="rounded-sm border border-warning/30 bg-warning/[0.06] p-3 text-body-lg text-text"
            >
              <p className="font-semibold">
                <span aria-hidden="true">⚑ </span>
                &ldquo;{flag.claim}&rdquo;
              </p>
              <p className="mt-0.5 text-muted">{flag.reason}</p>
            </li>
          ))}
        </ul>

        <label className="flex cursor-pointer items-start gap-2 text-control text-text">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5 accent-primary"
          />
          <span>
            I&rsquo;ve reviewed these claims and approve this content for publication.
          </span>
        </label>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-sm border border-border bg-surface-raised px-3.5 py-1.5 text-control font-semibold text-text hover:border-accent"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!acknowledged}
            onClick={onConfirm}
            className="rounded-sm border border-transparent bg-primary px-3.5 py-1.5 text-control font-semibold text-on-primary disabled:opacity-[.45]"
          >
            Approve post
          </button>
        </div>
      </div>
    </div>
  );
}
