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

// Returns the Monday that starts the week containing `date`, normalised to
// 09:00:00Z so it matches the orchestrator's week-start convention. The week
// runs Mon→Sun (getUTCDay: 0=Sun .. 6=Sat; days-since-Monday = (day + 6) % 7).
// Issue #6: "Generate this week" uses the current week's Monday as weekStart.
export function weekStartFor(date: Date): Date {
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  const monday = new Date(date.getTime());
  monday.setUTCDate(monday.getUTCDate() - daysSinceMonday);
  monday.setUTCHours(9, 0, 0, 0);
  return monday;
}