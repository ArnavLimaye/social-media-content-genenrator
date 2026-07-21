// CALENDAR — pure date helpers behind the Board's calendar modes (issue #9).
// -----------------------------------------------------------------------------
// Everything here is UTC. A Post's `scheduledDate` is written in UTC by the
// orchestrator (lib/schedule-dates.ts) and crosses to the client as an ISO
// string, so bucketing a Post onto a calendar day must read UTC too — a local
// getter would slide a 09:00Z post onto the previous day for any operator west
// of Greenwich, silently mis-placing it on the grid.
//
// Pure: no I/O, no clock. The anchor date is always passed in, which is what
// makes the calendar views deterministic under test.

// The UTC calendar day a date falls on, as `YYYY-MM-DD`. This is the bucket key
// shared by both calendar modes.
export function dateKey(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// "Mon · Jul 20" — the week-list day heading.
export function dayLabel(date: Date): string {
  return `${DOW[date.getUTCDay()]} · ${MON[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

// "Week of Jul 20" — the week-list period heading.
export function weekLabel(weekStart: Date): string {
  return `Week of ${MON[weekStart.getUTCMonth()]} ${weekStart.getUTCDate()}`;
}

// "Jul 20 – Jul 26" — the board header's week stepper label. Distinct from
// `weekLabel` on purpose: the dashboard talks about "the week of" a Monday,
// while the board is showing you a SPAN and both ends matter.
export function weekRangeLabel(weekStart: Date): string {
  const end = addWeeks(weekStart, 1);
  end.setUTCDate(end.getUTCDate() - 1);
  return `${MON[weekStart.getUTCMonth()]} ${weekStart.getUTCDate()} – ${MON[end.getUTCMonth()]} ${end.getUTCDate()}`;
}

// "July 2026" — the month-grid period heading.
const MONTH_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function monthLabel(date: Date): string {
  return `${MONTH_FULL[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

// "Jul 6" — a month-grid day cell's accessible name. The month is repeated on
// every cell, not just the day number, so the spill cells at either end of the
// grid are unambiguous when read aloud.
export function cellLabel(date: Date): string {
  return `${MON[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

// Step a month anchor, forward or back. Normalised to the 1st, because stepping
// from a later day overflows: Jan 31 plus one month is Mar 3, which would skip
// February entirely. Callers only ever anchor a grid on a month, never a day.
export function addMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

// Step a date by whole weeks, forward or back. Returns a fresh Date; the input
// is never mutated (the same contract as lib/schedule-dates.ts).
export function addWeeks(date: Date, weeks: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + weeks * 7);
  return next;
}

// Every day the month grid renders for the month containing `anchor`: whole
// Monday-start weeks covering that month, so the grid is always rectangular.
//
// Most months do not begin on a Monday or end on a Sunday, so the grid spills
// into the adjacent months at one or both ends. Those spill days are real days
// and are returned as such — a Post scheduled on Aug 1 shows in the July grid's
// trailing week, which is the whole point of rendering complete weeks. Callers
// tell a spill day from an in-month day with `isSameMonth`.
export function monthGridDays(anchor: Date): Date[] {
  const year = anchor.getUTCFullYear();
  const month = anchor.getUTCMonth();
  // day 0 of the next month is the last day of this one
  const lastOfMonth = new Date(Date.UTC(year, month + 1, 0));

  const start = new Date(Date.UTC(year, month, 1));
  start.setUTCDate(start.getUTCDate() - daysSinceMonday(start));

  const end = new Date(lastOfMonth.getTime());
  end.setUTCDate(end.getUTCDate() + daysUntilSunday(end));

  const days: Date[] = [];
  for (let d = new Date(start.getTime()); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(new Date(d.getTime()));
  }
  return days;
}

// getUTCDay: 0=Sun .. 6=Sat, so Monday-relative arithmetic shifts by 6 (the
// same convention as `weekStartFor` in lib/schedule-dates.ts).
function daysSinceMonday(date: Date): number {
  return (date.getUTCDay() + 6) % 7;
}

function daysUntilSunday(date: Date): number {
  return (7 - date.getUTCDay()) % 7;
}

// Whether a grid day belongs to the month being displayed, or is spill from an
// adjacent month.
export function isSameMonth(date: Date, anchor: Date): boolean {
  return (
    date.getUTCFullYear() === anchor.getUTCFullYear() &&
    date.getUTCMonth() === anchor.getUTCMonth()
  );
}

// Group items by the UTC day of a date they carry. Generic over the item so the
// calendar module never has to know what a Post is; items with no date (a Post
// that was never scheduled) are dropped rather than bucketed under a fake day.
export function bucketByDate<T>(
  items: T[],
  getDate: (item: T) => string | Date | null | undefined,
): Map<string, T[]> {
  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const date = getDate(item);
    if (!date) continue;
    const key = dateKey(date);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  }
  return buckets;
}
