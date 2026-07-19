// SCHEDULE-DATES — pure helper (issue #5).
// -----------------------------------------------------------------------------
// Derives a post's `scheduledDate` from the plan's week start (a Monday) plus
// the planner's Mon/Wed/Fri day. Pure: returns new Dates, never touches the
// input, does no I/O. The orchestrator owns week-start correctness; this only
// does date arithmetic so it can be tested without a database or network.
//
// ADR-0002: the three-day Mon/Wed/Fri shape is a hardcoded constant, so the
// offsets (0/2/4) are fixed here.

export type DayName = "Monday" | "Wednesday" | "Friday";

const OFFSET_DAYS: Record<DayName, number> = {
  Monday: 0,
  Wednesday: 2,
  Friday: 4,
};

// Returns the Mon/Wed/Fri dates for the week starting `weekStart` (a Monday).
// Each date is a fresh Date offset by the day's fixed number of days; the
// time component of `weekStart` is preserved. The input is never mutated.
export function scheduleDates(weekStart: Date): Record<DayName, Date> {
  return {
    Monday: addDays(weekStart, OFFSET_DAYS.Monday),
    Wednesday: addDays(weekStart, OFFSET_DAYS.Wednesday),
    Friday: addDays(weekStart, OFFSET_DAYS.Friday),
  };
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}