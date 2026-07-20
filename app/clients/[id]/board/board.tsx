"use client";

import { useEffect, useState } from "react";
import type { SerializedPost } from "@/lib/posts";
import {
  readStoredView,
  resolveBoardView,
  writeStoredView,
  type BoardView,
} from "@/lib/board-view";
import type { PostCardProps } from "./post-card";
import { Kanban } from "./kanban";
import { WeekList } from "./week-list";
import { MonthGrid } from "./month-grid";

// The Board — one view over a Client's Posts with switchable modes (CONTEXT.md):
// the kanban grouped by status (#8), plus the week-list and month-grid calendar
// modes driven by `scheduledDate` (#9). This component owns only the mode
// switch and the anchored period; each mode owns its own layout.
//
// No color prop: accent-painted elements inside the cards read `--color-accent`,
// so the <BrandOverlay> wrapping the page rebrands every mode per Client with
// zero component changes here (design-lock §4).

export type BoardProps = Pick<
  PostCardProps,
  "onEditField" | "onEditHashtags" | "onEditSlide"
> & {
  posts: SerializedPost[];
  // The date the calendar modes anchor on, as an ISO string. Injected rather
  // than read from the clock so server and client agree and tests are
  // deterministic; defaults to now.
  today?: string;
  // The raw `?view=` from the URL, unvalidated — resolving it is this
  // component's job (lib/board-view.ts), not the caller's.
  urlView?: string | null;
  // Called when the operator switches modes, so the page can put the choice in
  // the URL. Injected rather than reaching for the router here, which keeps the
  // Board renderable in a test without a Next router.
  onViewChange?: (view: BoardView) => void;
};

const VIEWS: Array<{ key: BoardView; label: string }> = [
  { key: "kanban", label: "Kanban" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
];

export function Board({
  posts,
  today = new Date().toISOString(),
  urlView,
  onViewChange,
  onEditField,
  onEditHashtags,
  onEditSlide,
}: BoardProps) {
  // Seeded from the URL alone, because the server renders this too and cannot
  // see localStorage. The stored preference is folded in on mount below.
  const [view, setView] = useState<BoardView>(() => resolveBoardView(urlView, null));

  useEffect(() => {
    setView(resolveBoardView(urlView, readStoredView(window.localStorage)));
  }, [urlView]);

  // A switch is recorded in both places: storage so it survives leaving the
  // Board entirely, and the URL so a reload or a shared link lands in the same
  // mode.
  const chooseView = (next: BoardView) => {
    setView(next);
    writeStoredView(window.localStorage, next);
    onViewChange?.(next);
  };

  const editing = { onEditField, onEditHashtags, onEditSlide };

  return (
    <div className="flex flex-col gap-4">
      <ViewToggle view={view} onChange={chooseView} />
      {view === "kanban" ? <Kanban posts={posts} {...editing} /> : null}
      {view === "week" ? <WeekList posts={posts} today={today} {...editing} /> : null}
      {view === "month" ? <MonthGrid posts={posts} today={today} {...editing} /> : null}
    </div>
  );
}

// The mode switcher. Buttons rather than links: switching a view is a local UI
// state change, not navigation to a different resource.
function ViewToggle({
  view,
  onChange,
}: {
  view: BoardView;
  onChange: (view: BoardView) => void;
}) {
  return (
    <div className="flex gap-1 self-start rounded-pill border border-border p-1">
      {VIEWS.map((v) => (
        <button
          key={v.key}
          type="button"
          onClick={() => onChange(v.key)}
          aria-pressed={view === v.key}
          className={
            view === v.key
              ? "rounded-pill bg-accent px-3 py-1 text-xs font-bold uppercase tracking-wider text-on-accent"
              : "rounded-pill px-3 py-1 text-xs font-bold uppercase tracking-wider text-muted hover:bg-surface hover:text-text"
          }
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
