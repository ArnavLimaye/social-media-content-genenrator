"use client";

import { STEP_BUTTON } from "@/app/ui";

// The period stepper shared by both calendar modes: ‹ label ›. Shared so the
// two modes cannot drift into different affordances for the same gesture.
//
// The step direction is all this owns — what a "period" means is the calling
// mode's business, which is why the button labels are passed in rather than
// derived here (a screen-reader user hears "Next week" or "Next month", never a
// bare arrow).
//
// `width` fixes the label box so stepping through periods does not shuffle the
// arrows left and right as the label's length changes. It differs per mode
// because "Jul 20 – Jul 26" and "July 2026" are not the same width.
export function PeriodNav({
  label,
  previousLabel,
  nextLabel,
  width,
  onStep,
}: {
  label: string;
  previousLabel: string;
  nextLabel: string;
  width: string;
  onStep: (delta: number) => void;
}) {
  return (
    <div className="flex flex-none items-center gap-2">
      <button
        type="button"
        aria-label={previousLabel}
        onClick={() => onStep(-1)}
        className={STEP_BUTTON}
      >
        <span aria-hidden="true">‹</span>
      </button>
      <span className={`${width} text-center text-control font-semibold text-text`}>
        {label}
      </span>
      <button
        type="button"
        aria-label={nextLabel}
        onClick={() => onStep(1)}
        className={STEP_BUTTON}
      >
        <span aria-hidden="true">›</span>
      </button>
    </div>
  );
}
