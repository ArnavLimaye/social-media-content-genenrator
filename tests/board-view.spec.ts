import { describe, it, expect } from "vitest";
import {
  resolveBoardView,
  readStoredView,
  writeStoredView,
  type BoardView,
} from "@/lib/board-view";

// Issue #9 — which Board mode the operator lands in. Two sources, deliberately
// ranked: a `?view=` in the URL is an explicit request (a pasted or bookmarked
// link) and wins; localStorage is the standing preference and backs it up, so
// the choice survives leaving the Board and coming back via the dashboard.
//
// Pure, and the storage helpers take the store as an argument, so this is
// tested without a browser or a router.

// A Storage-shaped stub. Simpler than mocking the global, and it lets a test
// model a browser that refuses to store anything.
function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

describe("resolveBoardView: the URL wins, storage backs it", () => {
  it("takes the URL's view when it names one", () => {
    expect(resolveBoardView("week", null)).toBe("week");
    expect(resolveBoardView("month", null)).toBe("month");
  });

  it("prefers the URL over a conflicting stored preference", () => {
    expect(resolveBoardView("month", "week")).toBe("month");
  });

  it("falls back to the stored preference when the URL names none", () => {
    expect(resolveBoardView(null, "week")).toBe("week");
  });

  it("falls back to kanban when neither source names a valid view", () => {
    expect(resolveBoardView(null, null)).toBe("kanban");
    expect(resolveBoardView("", "")).toBe("kanban");
  });

  it("ignores a value that is not a view rather than rendering nothing", () => {
    // A hand-edited URL or a stale storage entry from a future version must not
    // leave the operator on a Board with no mode selected.
    expect(resolveBoardView("gantt", null)).toBe("kanban");
    expect(resolveBoardView("gantt", "week")).toBe("week");
    expect(resolveBoardView(null, "gantt")).toBe("kanban");
  });
});

describe("stored view: round-tripping the standing preference", () => {
  it("round-trips a view through the store", () => {
    const store = fakeStorage();
    writeStoredView(store, "month");
    expect(readStoredView(store)).toBe("month");
  });

  it("reads null from an empty store", () => {
    expect(readStoredView(fakeStorage())).toBeNull();
  });

  it("reads null rather than a junk value the app would have to handle", () => {
    expect(readStoredView(fakeStorage({ "board-view": "gantt" }))).toBeNull();
  });

  it("survives a browser that refuses to store (private mode, disabled storage)", () => {
    const throwing = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("SecurityError");
      },
    };
    // The view preference is a convenience; losing it must never take the Board
    // down with it.
    expect(() => writeStoredView(throwing, "week" as BoardView)).not.toThrow();
    expect(readStoredView(throwing)).toBeNull();
  });
});
