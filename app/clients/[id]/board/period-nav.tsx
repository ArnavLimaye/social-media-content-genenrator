"use client";

// The period stepper shared by both calendar modes (issue #9): ← label →.
// Shared so the two modes cannot drift into different affordances for the same
// gesture. The step direction is all this owns — what a "period" means is the
// calling mode's business, which is why the button labels are passed in rather
// than derived here (a screen-reader user hears "Next week" or "Next month",
// never a bare arrow).

export function PeriodNav({
  label,
  previousLabel,
  nextLabel,
  onStep,
}: {
  label: string;
  previousLabel: string;
  nextLabel: string;
  onStep: (delta: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <StepButton label={previousLabel} glyph="←" onClick={() => onStep(-1)} />
      <span className="text-sm font-semibold text-text">{label}</span>
      <StepButton label={nextLabel} glyph="→" onClick={() => onStep(1)} />
    </div>
  );
}

function StepButton({
  label,
  glyph,
  onClick,
}: {
  label: string;
  glyph: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="rounded-sm border border-border px-2 py-1 text-sm text-muted hover:bg-surface hover:text-text"
    >
      <span aria-hidden="true">{glyph}</span>
    </button>
  );
}
