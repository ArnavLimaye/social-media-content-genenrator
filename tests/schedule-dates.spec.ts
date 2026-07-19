import { describe, it, expect } from "vitest";
import { scheduleDates, weekStartFor } from "@/lib/schedule-dates";

// Issue #5 — `schedule-dates` is a PURE helper that derives a post's
// `scheduledDate` from the plan's week start (a Monday) plus the planner's
// Mon/Wed/Fri day. The orchestrator owns week-start correctness; this helper
// only does date arithmetic. No I/O, no mutation, no timezone surprises —
// these tests describe behavior that survives any internal refactor.

describe("scheduleDates: Mon/Wed/Fri from a Monday week start", () => {
  it("returns Mon/Wed/Fri at +0/+2/+4 days within a single month, preserving time", () => {
    const weekStart = new Date("2026-07-20T09:00:00Z"); // a Monday
    const dates = scheduleDates(weekStart);

    expect(dates.Monday.toISOString()).toBe("2026-07-20T09:00:00.000Z");
    expect(dates.Wednesday.toISOString()).toBe("2026-07-22T09:00:00.000Z");
    expect(dates.Friday.toISOString()).toBe("2026-07-24T09:00:00.000Z");
  });

  it("crosses a month boundary (week start Mon 2026-08-31 → Fri 2026-09-04)", () => {
    const weekStart = new Date("2026-08-31T09:00:00Z"); // Monday
    const dates = scheduleDates(weekStart);

    expect(dates.Monday.toISOString()).toBe("2026-08-31T09:00:00.000Z");
    expect(dates.Wednesday.toISOString()).toBe("2026-09-02T09:00:00.000Z");
    expect(dates.Friday.toISOString()).toBe("2026-09-04T09:00:00.000Z");
  });

  it("crosses a year boundary (week start Mon 2026-12-28 → Fri 2027-01-01)", () => {
    const weekStart = new Date("2026-12-28T09:00:00Z"); // Monday
    const dates = scheduleDates(weekStart);

    expect(dates.Monday.toISOString()).toBe("2026-12-28T09:00:00.000Z");
    expect(dates.Wednesday.toISOString()).toBe("2026-12-30T09:00:00.000Z");
    expect(dates.Friday.toISOString()).toBe("2027-01-01T09:00:00.000Z");
  });

  it("does not mutate the input weekStart", () => {
    const weekStart = new Date("2026-07-20T09:00:00Z");
    const snapshot = weekStart.toISOString();
    scheduleDates(weekStart);
    expect(weekStart.toISOString()).toBe(snapshot);
  });
});

// weekStartFor derives the Monday that starts the week containing `date`,
// normalised to 09:00:00Z so it matches the orchestrator's week-start
// convention (issue #6 — "Generate this week" uses the current week's Monday).
describe("weekStartFor: Monday of the week containing a date", () => {
  it("rolls a Wednesday back to that week's Monday", () => {
    const monday = weekStartFor(new Date("2026-07-22T14:30:00Z")); // Wednesday
    expect(monday.toISOString()).toBe("2026-07-20T09:00:00.000Z");
  });

  it("treats Sunday as the end of the week (rolls back to the prior Monday)", () => {
    const monday = weekStartFor(new Date("2026-07-26T08:00:00Z")); // Sunday
    expect(monday.toISOString()).toBe("2026-07-20T09:00:00.000Z");
  });

  it("returns the same Monday when the date is already a Monday", () => {
    const monday = weekStartFor(new Date("2026-07-20T22:00:00Z")); // Monday, late
    expect(monday.toISOString()).toBe("2026-07-20T09:00:00.000Z");
  });
});