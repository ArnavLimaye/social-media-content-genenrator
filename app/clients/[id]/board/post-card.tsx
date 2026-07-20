"use client";

import { useState, useRef, useLayoutEffect } from "react";
import type { SerializedPost, Slide, ReviewFlag } from "@/lib/posts";

// The Post card — the reusable centrepiece of the Board (issue #8) and later
// #9's week-list / drawer. Built to the #7 design lock (docs/design/post-card.md):
// one column, badge row → date line → topic + hook → review flags → slides →
// caption → CTA → hashtags → footer. Every value is a token-derived class
// (ADR-0003); accent-painted elements (pillar badge, image-idea `creative`
// chips, hashtags) read `--color-accent`, so the surrounding <BrandOverlay>
// rebrands them per Client with zero component changes (design-lock §4).
//
// Inline-editable copy fields commit on blur through injected callbacks. The
// page wires real server actions; tests inject fakes. Editing is the only
// mutation in this slice — footer status actions are rendered but inert (#10
// wires transitions and the flag-acknowledgment gate).

export type PostCardProps = {
  post: SerializedPost;
  onEditField: (postId: string, field: "hook" | "caption" | "cta", value: string) => void;
  onEditHashtags: (postId: string, hashtags: string[]) => void;
  onEditSlide: (
    postId: string,
    slideIndex: number,
    field: "heading" | "description",
    value: string,
  ) => void;
};

// Format badge glyph (design-lock §2): carousel ▤, reel ▶, infographic ◫.
const FORMAT_GLYPH: Record<string, string> = {
  carousel: "▤",
  reel: "▶",
  infographic: "◫",
};

// Status badge recipe (design-lock §2): one shared shape, colored per status.
const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-muted/10 border-muted/25 text-muted" },
  approved: { label: "Approved", cls: "bg-accent/10 border-accent/25 text-accent" },
  published: { label: "✓ Published", cls: "bg-success/10 border-success/25 text-success" },
  failed: { label: "Failed", cls: "bg-danger/10 border-danger/25 text-danger" },
};

export function PostCard({ post, onEditField, onEditHashtags, onEditSlide }: PostCardProps) {
  const status = STATUS_BADGE[post.status] ?? STATUS_BADGE.draft;

  return (
    <article className="flex flex-col gap-3 rounded border border-border bg-surface-raised p-5 shadow-sm">
      {/* badge row */}
      <div className="flex items-center gap-2">
        <span className="rounded-pill border border-border px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-muted">
          <span aria-hidden="true">{FORMAT_GLYPH[post.format] ?? "▤"}</span>{" "}
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
      {post.scheduledDate ? <DateLine iso={post.scheduledDate} /> : null}

      {/* topic + hook */}
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold text-text">{post.topic}</h3>
        <InlineText
          ariaLabel={`Hook — ${post.topic}`}
          value={post.hook ?? ""}
          onCommit={(v) => onEditField(post.id, "hook", v)}
          className="text-sm italic text-muted"
        />
      </div>

      {/* review flags — only when present (next slice expands) */}
      {post.reviewFlags && post.reviewFlags.length > 0 ? (
        <ReviewFlags flags={post.reviewFlags} />
      ) : null}

      {/* slides */}
      {post.slides && post.slides.length > 0 ? (
        <SlideList
          slides={post.slides}
          topic={post.topic}
          onEditSlide={(index, field, value) => onEditSlide(post.id, index, field, value)}
        />
      ) : null}

      {/* caption */}
      <Section label="Caption">
        <InlineText
          ariaLabel={`Caption — ${post.topic}`}
          value={post.caption ?? ""}
          multiline
          onCommit={(v) => onEditField(post.id, "caption", v)}
          className="text-sm text-text"
        />
      </Section>

      {/* CTA */}
      <Section label="CTA">
        <InlineText
          ariaLabel={`CTA — ${post.topic}`}
          value={post.cta ?? ""}
          onCommit={(v) => onEditField(post.id, "cta", v)}
          className="text-sm font-semibold text-text"
        />
      </Section>

      {/* hashtags */}
      {post.hashtags && post.hashtags.length > 0 ? (
        <InlineHashtags
          hashtags={post.hashtags}
          topic={post.topic}
          onCommit={(tags) => onEditHashtags(post.id, tags)}
        />
      ) : null}

      {/* footer — status actions render inert until #10 */}
      <Footer status={post.status} />
    </article>
  );
}

// The kanban date line: "Wed · Jul 22". Computed with UTC getters so it is
// deterministic regardless of the operator's timezone (the scheduledDate is an
// ISO string from the server).
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function DateLine({ iso }: { iso: string }) {
  const d = new Date(iso);
  return (
    <p className="text-xs font-medium text-muted">
      {DOW[d.getUTCDay()]} · {MON[d.getUTCMonth()]} {d.getUTCDate()}
    </p>
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

// Placeholder for the slide list + flags + footer, filled in by later slices.
function SlideList({
  slides,
  topic,
  onEditSlide,
}: {
  slides: Slide[];
  topic: string;
  onEditSlide: (index: number, field: "heading" | "description", value: string) => void;
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
              onCommit={(v) => onEditSlide(i, "heading", v)}
              className="text-sm font-semibold text-text"
            />
            <InlineText
              ariaLabel={`Slide ${i + 1} description — ${topic}`}
              value={slide.description}
              multiline
              onCommit={(v) => onEditSlide(i, "description", v)}
              className="text-sm text-muted"
            />
            <ImageIdeaChips ideas={slide.imageIdeas} />
          </div>
        </li>
      ))}
    </ol>
  );
}

// Image-idea chips encode type by color AND repeat the kind as uppercase text
// inside, so the distinction is never color-only (design-lock §2).
function ImageIdeaChips({ ideas }: { ideas: Slide["imageIdeas"] }) {
  return (
    <ul className="flex flex-wrap gap-1">
      {ideas.map((idea, i) => (
        <li
          key={i}
          className={
            idea.type === "creative"
              ? "rounded-pill border border-accent bg-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent"
              : "rounded-pill border border-border bg-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted"
          }
        >
          {idea.type}
        </li>
      ))}
    </ul>
  );
}

function ReviewFlags({ flags }: { flags: ReviewFlag[] }) {
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
        ⚑ {flags.length} flags {open ? "▲" : "▼"}
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
  onCommit,
}: {
  hashtags: string[];
  topic: string;
  onCommit: (hashtags: string[]) => void;
}) {
  const joined = hashtags.join(" ");
  const [value, setValue] = useState(joined);
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
}: {
  ariaLabel: string;
  value: string;
  onCommit: (value: string) => void;
  className?: string;
  multiline?: boolean;
}) {
  const [text, setText] = useState(value);

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

// Footer: status note left, actions right. Actions are inert until #10 wires
// transitions + the flag-acknowledgment gate.
function Footer({ status }: { status: string }) {
  const note: Record<string, string> = {
    draft: "Ready for review",
    approved: "Queued",
    published: "Published · read-only",
    failed: "Copy failed",
  };
  return (
    <footer className="flex items-center justify-between border-t border-border pt-3 text-xs text-muted">
      <span className={status === "published" ? "font-semibold text-success" : ""}>
        {note[status] ?? "Ready for review"}
      </span>
      <span className="flex gap-1" aria-hidden="true">
        {status === "draft" ? <span className="rounded-sm border border-border px-2 py-0.5">Approve</span> : null}
        {status === "approved" ? <span className="rounded-sm border border-border px-2 py-0.5">Publish</span> : null}
        {status === "failed" ? <span className="rounded-sm border border-border px-2 py-0.5">↻ Regenerate</span> : null}
      </span>
    </footer>
  );
}