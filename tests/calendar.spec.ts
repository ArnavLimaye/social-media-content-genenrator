import { describe, it, expect } from "vitest";
import { monthGridDays, dateKey, bucketByDate } from "@/lib/calendar";

// Issue #9 — the pure date engine behind the Board's calendar modes. The month
// grid's boundary behavior is the correctness-critical part (a month rarely
// starts on a Monday, so most grids spill into the adjacent months), so it is
// tested here directly, without a DOM.
//
// July 2026 is the worked example throughout: it starts on a Wednesday and ends
// on a Friday, so the grid spills at both ends.

describe("monthGridDays: whole Monday-start weeks covering a month", () => {
  it("spills into the adjacent months so every week is complete", () => {
    const days = monthGridDays(new Date("2026-07-15T00:00:00.000Z"));

    // Jul 1 is a Wednesday, so the grid opens on Mon Jun 29; Jul 31 is a
    // Friday, so it closes on Sun Aug 2.
    expect(dateKey(days[0])).toBe("2026-06-29");
    expect(dateKey(days[days.length - 1])).toBe("2026-08-02");
    expect(days).toHaveLength(35);
  });

  it("always yields a whole number of weeks", () => {
    for (const iso of [
      "2026-02-10T00:00:00.000Z", // short month
      "2026-06-10T00:00:00.000Z", // starts on a Monday
      "2026-11-10T00:00:00.000Z",
      "2027-01-10T00:00:00.000Z", // crosses a year boundary
    ]) {
      const days = monthGridDays(new Date(iso));
      expect(days.length % 7).toBe(0);
      expect(days[0].getUTCDay()).toBe(1); // Monday
      expect(days[days.length - 1].getUTCDay()).toBe(0); // Sunday
    }
  });

  it("does not pad a month that already fills whole weeks at its start", () => {
    // June 2026 begins on a Monday — the grid must start on Jun 1 itself, not
    // on the Monday of the week before it.
    const days = monthGridDays(new Date("2026-06-10T00:00:00.000Z"));
    expect(dateKey(days[0])).toBe("2026-06-01");
  });

  it("runs the days consecutively with no gaps or repeats", () => {
    const days = monthGridDays(new Date("2026-07-15T00:00:00.000Z"));
    const keys = days.map(dateKey);
    expect(new Set(keys).size).toBe(keys.length);
    for (let i = 1; i < days.length; i++) {
      const gap = days[i].getTime() - days[i - 1].getTime();
      expect(gap).toBe(24 * 60 * 60 * 1000);
    }
  });

  it("crosses a year boundary", () => {
    // Dec 2026: Dec 1 is a Tuesday, so the grid opens on Mon Nov 30 and the
    // trailing week runs into January.
    const days = monthGridDays(new Date("2026-12-10T00:00:00.000Z"));
    expect(dateKey(days[0])).toBe("2026-11-30");
    expect(dateKey(days[days.length - 1])).toBe("2027-01-03");
  });
});

describe("bucketByDate: grouping by UTC calendar day", () => {
  it("groups items landing on the same day and drops undated ones", () => {
    const items = [
      { id: "a", when: "2026-07-22T09:00:00.000Z" },
      { id: "b", when: "2026-07-22T23:30:00.000Z" },
      { id: "c", when: "2026-07-24T09:00:00.000Z" },
      { id: "d", when: null },
    ];

    const buckets = bucketByDate(items, (i) => i.when);

    expect(buckets.get("2026-07-22")?.map((i) => i.id)).toEqual(["a", "b"]);
    expect(buckets.get("2026-07-24")?.map((i) => i.id)).toEqual(["c"]);
    // an item with no date is not bucketed under a fabricated day
    expect([...buckets.values()].flat().map((i) => i.id)).not.toContain("d");
  });

  it("buckets by UTC, not by the machine's local day", () => {
    // A 09:00Z post belongs to that UTC day for every operator. Reading local
    // getters would slide it a day earlier west of Greenwich.
    const buckets = bucketByDate([{ when: "2026-07-22T00:30:00.000Z" }], (i) => i.when);
    expect([...buckets.keys()]).toEqual(["2026-07-22"]);
  });
});
