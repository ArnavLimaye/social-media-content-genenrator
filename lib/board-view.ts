// BOARD-VIEW — which mode the Board opens in (issue #9).
// -----------------------------------------------------------------------------
// Two sources, deliberately ranked. A `?view=` in the URL is an explicit request
// — a pasted link, a bookmark, a reload — and wins. localStorage is the standing
// preference, which is what makes the choice survive leaving the Board entirely
// and returning through the Client dashboard, where no query string carries it.
//
// Pure, and the storage helpers take the store as an argument rather than
// reaching for `window`, so the whole rule is testable without a browser.

export type BoardView = "kanban" | "week" | "month";

const VIEWS: readonly BoardView[] = ["kanban", "week", "month"];

const STORAGE_KEY = "board-view";

// The narrow slice of the Storage interface this module needs. Anything with
// these two methods will do — the real `window.localStorage`, or a stub.
export type ViewStore = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

export function isBoardView(value: unknown): value is BoardView {
  return typeof value === "string" && (VIEWS as readonly string[]).includes(value);
}

// The mode to render, given what the URL asked for and what was last stored.
// Anything unrecognised in either slot is discarded rather than propagated: a
// hand-edited URL or a stale entry written by a future version must not leave
// the operator looking at a Board with no mode selected.
export function resolveBoardView(
  urlView: string | null | undefined,
  storedView: string | null | undefined,
): BoardView {
  if (isBoardView(urlView)) return urlView;
  if (isBoardView(storedView)) return storedView;
  return "kanban";
}

// Storage access is wrapped because it genuinely throws: Safari in private mode
// and browsers with site data disabled raise on access, not just on write. The
// view preference is a convenience, so a store that refuses simply means no
// preference — it must never take the Board down.
export function readStoredView(store: ViewStore): BoardView | null {
  try {
    const raw = store.getItem(STORAGE_KEY);
    return isBoardView(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writeStoredView(store: ViewStore, view: BoardView): void {
  try {
    store.setItem(STORAGE_KEY, view);
  } catch {
    // no preference is better than a crash
  }
}
