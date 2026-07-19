import { clinicInitials } from "@/lib/clinic-initials";

// Shared surface + typography primitives from the #7 design lock (#14).
//
// These exist so the card idiom is defined once. Before this, every screen
// hand-rolled its own container and none of them used `surface-raised`, so the
// whole app rendered flat on `surface`. #8/#9 should build the Post card on
// <Card> rather than reinventing the shell.

// A raised surface. `surface-raised` + `border` + `shadow-sm` is the locked
// card recipe — see docs/design/post-card.md §1. Never `surface`: in dark mode
// raised is LIGHTER than the page and in light mode it is whiter, so a card on
// `surface` disappears in one of the two modes.
export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded border border-border bg-surface-raised p-5 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

// The locked field/section label: small, heavy, uppercase, wide-tracked, muted.
// docs/design/post-card.md §2.
export function MicroLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-bold uppercase tracking-widest text-muted">{children}</span>
  );
}

// The clinic identity tile — logo if there is one, initials on an accent fill
// otherwise. The fallback uses `on-accent` for its foreground because the
// brand overlay can put an arbitrary clinic color on `--color-accent` (#7), so
// the readable foreground cannot be assumed. That means the fallback rebrands
// per Client for free.
export function ClinicTile({
  name,
  logoUrl,
  size = "md",
}: {
  name: string;
  logoUrl?: string | null;
  size?: "sm" | "md";
}) {
  const box = size === "sm" ? "h-8 w-8 text-xs" : "h-12 w-12 text-xl";

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
