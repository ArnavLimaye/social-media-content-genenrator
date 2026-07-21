import { clinicInitials } from "@/lib/clinic-initials";

// The shared visual vocabulary of the Content Back-Office design.
//
// Every recipe the design repeats across screens lives here exactly once: the
// card shell, the two label sizes, the status badge, the pillar chip, the
// segmented tab, the button pair, the stepper. Before this file grew past
// <Card>, each screen hand-rolled its own — which is how the header nav, the
// board view switcher, and the kanban column headers ended up as three
// different treatments of the same idea.
//
// No component here names a color, radius, or font literal: everything is a
// token-derived utility (ADR-0003), so the per-Client <BrandOverlay> rebrands
// the whole vocabulary by swapping one custom property.

// A raised surface. `surface-raised` + `border` + `shadow-sm` is the locked
// card recipe — see docs/design/post-card.md §1. Never `surface`: in dark mode
// raised is LIGHTER than the page and in light mode it is whiter, so a card on
// `surface` disappears in one of the two modes.
//
// `padded` exists because the Post card is the one card whose padding is
// per-section rather than on the shell — its footer rule has to run edge to
// edge, which an outer padding makes impossible.
export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={`rounded border border-border bg-surface-raised shadow-sm ${
        padded ? "p-5" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

// The locked field/section label: small, heavy, uppercase, wide-tracked, muted.
// docs/design/post-card.md §2. Used for form field labels, kanban column
// headers, and the dashboard's panel headings.
export function MicroLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-label-lg font-bold uppercase text-muted">{children}</span>
  );
}

// The smaller sibling, for labels INSIDE a card body — the Post card's
// "Caption" and "CTA" heads. Tighter and heavier than <MicroLabel> so it reads
// as a sub-division of the card rather than as another card's title.
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-label-xs font-extrabold uppercase text-muted">{children}</span>
  );
}

// The clinic identity tile — logo if there is one, initials on an accent fill
// otherwise. The fallback uses `on-accent` for its foreground because the
// brand overlay can put an arbitrary clinic color on `--color-accent` (#7), so
// the readable foreground cannot be assumed. That means the fallback rebrands
// per Client for free.
//
// Three sizes, one per place the design puts it: `lg` on the dashboard identity
// card, `md` in the onboarding logo preview, `sm` in the board header and the
// client list.
const TILE_SIZE = {
  sm: "h-[26px] w-[26px] text-body-xs",
  md: "h-10 w-10 text-title-sm",
  lg: "h-[52px] w-[52px] text-heading",
} as const;

export function ClinicTile({
  name,
  logoUrl,
  size = "lg",
}: {
  name: string;
  logoUrl?: string | null;
  size?: keyof typeof TILE_SIZE;
}) {
  const box = TILE_SIZE[size];

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={name}
        // `contain` on `surface`: clinic logos are rarely square and often
        // transparent, so cropping or letting them bleed both look broken.
        className={`${box} flex-none rounded-sm border border-border bg-surface object-contain`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${box} flex flex-none items-center justify-center rounded-sm bg-accent font-extrabold text-on-accent`}
    >
      {clinicInitials(name)}
    </span>
  );
}

// The status badge (design-lock §2): one shape, tinted per lifecycle state.
// The fill, border, and text are all struck from the SAME token at three
// opacities, so a new state needs one token name rather than three chosen
// colors — and every state stays legible in both modes automatically.
export type BadgeTone = "muted" | "accent" | "success" | "danger" | "warning";

const BADGE_TONE: Record<BadgeTone, string> = {
  muted: "text-muted bg-muted/12 border-muted/25",
  accent: "text-accent bg-accent/12 border-accent/25",
  success: "text-success bg-success/12 border-success/25",
  danger: "text-danger bg-danger/12 border-danger/25",
  warning: "text-warning bg-warning/12 border-warning/25",
};

export function Badge({
  tone,
  children,
}: {
  tone: BadgeTone;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex flex-none items-center gap-1 whitespace-nowrap rounded-pill border px-2 py-0.5 text-label font-bold uppercase ${BADGE_TONE[tone]}`}
    >
      {children}
    </span>
  );
}

// The format badge: outlined rather than tinted, because format is a neutral
// fact about a Post while status is a state worth coloring.
export function OutlineBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex flex-none items-center gap-1 whitespace-nowrap rounded-pill border border-border px-2 py-0.5 text-label font-bold uppercase text-muted">
      {children}
    </span>
  );
}

// The pillar chip — accent-tinted and NOT uppercase, so it reads as the clinic's
// own vocabulary rather than as another piece of system chrome.
//
// It TRUNCATES. The design's pillars are two-word labels ("Patient education"),
// but nothing stops an operator entering a whole sentence, and real ones do:
// left to size themselves, sentence-length chips push past the card edge and
// squeeze the clinic name into a one-word-per-line column. `title` keeps the
// full text reachable on hover, and the field itself is still fully readable on
// the onboarding form.
export function PillarChip({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex min-w-0 max-w-full items-center gap-1 truncate rounded-pill bg-accent/10 px-2 py-0.5 text-label-lg font-semibold text-accent"
    >
      {children}
    </span>
  );
}

// The segmented tab, shared by the header nav and the board's view switcher —
// the design uses one treatment for both, and splitting it was what let them
// drift. The active tab is a `primary` tint, never a solid fill: a filled tab
// competes with the page's actual primary action.
export const TAB_BASE =
  "whitespace-nowrap rounded-sm border border-transparent px-3 py-[5px] text-body-lg font-semibold";

export function tabClass(active: boolean): string {
  return active
    ? `${TAB_BASE} bg-primary/10 text-primary`
    : `${TAB_BASE} bg-transparent text-muted hover:text-text`;
}

// The container that turns a row of tabs into a segmented control. Used by the
// board's view switcher; the header nav uses bare tabs on the header surface.
export function TabGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-none gap-0.5 rounded-sm border border-border bg-surface-raised p-0.5">
      {children}
    </div>
  );
}

// The two button weights the design uses. Primary is the page's one committing
// action; secondary is everything reversible.
export const BUTTON_PRIMARY =
  "inline-flex items-center gap-2 whitespace-nowrap rounded-sm border border-transparent bg-primary px-4 py-2 text-control font-semibold text-on-primary disabled:opacity-60";

export const BUTTON_SECONDARY =
  "inline-flex items-center gap-2 whitespace-nowrap rounded-sm border border-border bg-surface-raised px-3.5 py-1.5 text-body-lg font-semibold text-text hover:border-accent";

// The square period stepper (‹ ›) the calendar modes share.
export const STEP_BUTTON =
  "flex h-7 w-7 flex-none items-center justify-center rounded-sm border border-border bg-surface-raised text-muted hover:text-text";

// The in-button spinner. Its track is the button's own foreground at 35%, so it
// stays legible on `primary` in both modes without naming a color.
export function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-3 w-3 animate-spin rounded-pill border-2 border-on-primary/35"
      // The lit segment. Inline rather than a `border-t-*` utility because the
      // token-vocabulary guard reads `border-t-on-primary` as the unknown color
      // token "t-on-primary" — the class is fine, the guard cannot see it that
      // way, and an inline var reference is honest about what it sets.
      style={{ borderTopColor: "var(--color-on-primary)" }}
    />
  );
}
