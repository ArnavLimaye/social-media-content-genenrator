"use client";

import { useEffect, useState } from "react";
import type { SerializedPost } from "@/lib/posts";
import {
  readStoredView,
  resolveBoardView,
  writeStoredView,
  type BoardView,
} from "@/lib/board-view";
import { addMonths, addWeeks, monthLabel, weekRangeLabel } from "@/lib/calendar";
import { weekStartFor } from "@/lib/schedule-dates";
import { ClinicTile, TabGroup, tabClass } from "@/app/ui";
import type { PostCardProps } from "./post-card";
import { Kanban } from "./kanban";
import { WeekList, type WeekPillars } from "./week-list";
import { MonthGrid } from "./month-grid";
import { PeriodNav } from "./period-nav";

// The Board — one view over a Client's Posts with switchable modes: the kanban
// grouped by status, plus the week-list and month-grid calendar modes driven by
// `scheduledDate`.
//
// ONE header row owns the whole control surface: clinic identity, the view
// switcher, and — pushed to the far right — the period stepper for whichever
// calendar mode is showing. The stepper used to live inside each calendar mode,
// which put the chrome at a different height depending on the mode and made the
// modes disagree about where "the controls" are. Hoisting it also hoists the
// anchor state, so switching week → month → week no longer silently resets the
// operator's place.
//
// No color prop: accent-painted elements inside the cards read `--color-accent`,
// so the <BrandOverlay> wrapping the page rebrands every mode per Client with
// zero component changes here.

export type BoardProps = Pick<
  PostCardProps,
  "onEditField" | "onEditHashtags" | "onEditSlide" | "onApprove" | "onPublish"
> & {
  posts: SerializedPost[];
  clinicName: string;
  clinicLogoUrl?: string | null;
  // The clinic's pillar per posting day, for the week list's day gutter.
  pillars?: WeekPillars;
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
  clinicName,
  clinicLogoUrl,
  pillars,
  today = new Date().toISOString(),
  urlView,
  onViewChange,
  onEditField,
  onEditHashtags,
  onEditSlide,
  onApprove,
  onPublish,
}: BoardProps) {
  // Seeded from the URL alone, because the server renders this too and cannot
  // see localStorage. The stored preference is folded in on mount below.
  const [view, setView] = useState<BoardView>(() => resolveBoardView(urlView, null));
  // The anchored period, held as an offset from `today` rather than as a Date,
  // so the state stays serializable and the anchor is re-derived from one place.
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);

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

  const weekStart = addWeeks(weekStartFor(new Date(today)), weekOffset);
  const monthAnchor = addMonths(new Date(today), monthOffset);
  const editing = { onEditField, onEditHashtags, onEditSlide, onApprove, onPublish };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <ClinicTile name={clinicName} logoUrl={clinicLogoUrl} size="sm" />
          <h1 className="text-heading-sm font-semibold text-text">
            {clinicName}
            <span className="font-normal text-muted"> · Board</span>
          </h1>
        </div>

        <TabGroup>
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => chooseView(v.key)}
              aria-pressed={view === v.key}
              className={tabClass(view === v.key)}
            >
              {v.label}
            </button>
          ))}
        </TabGroup>

        <span className="flex-1" />

        {view === "week" ? (
          <PeriodNav
            label={weekRangeLabel(weekStart)}
            previousLabel="Previous week"
            nextLabel="Next week"
            width="w-[150px]"
            onStep={(n) => setWeekOffset((o) => o + n)}
          />
        ) : null}
        {view === "month" ? (
          <PeriodNav
            label={monthLabel(monthAnchor)}
            previousLabel="Previous month"
            nextLabel="Next month"
            width="w-[120px]"
            onStep={(n) => setMonthOffset((o) => o + n)}
          />
        ) : null}
      </div>

      {view === "kanban" ? <Kanban posts={posts} {...editing} /> : null}
      {view === "week" ? (
        <WeekList posts={posts} weekStart={weekStart} pillars={pillars} {...editing} />
      ) : null}
      {view === "month" ? (
        <MonthGrid posts={posts} anchor={monthAnchor} today={today} {...editing} />
      ) : null}
    </div>
  );
}
