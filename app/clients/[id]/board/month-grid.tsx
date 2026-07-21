"use client";

import { useState } from "react";
import type { SerializedPost } from "@/lib/posts";
import {
  bucketByDate,
  cellLabel,
  dateKey,
  isSameMonth,
  monthGridDays,
} from "@/lib/calendar";
import { postState } from "@/lib/post-state";
import type { PostCardProps } from "./post-card";
import { PostSummary } from "./post-badges";
import { PostDrawer } from "./post-drawer";

// The month-grid mode — a month at a glance, Posts placed on their scheduled
// dates. A cell displays; clicking it opens the drawer, because editing full
// caption and slide copy inside a small calendar square is impractical, so a
// cell carries a compact summary only.
//
// The grid lines are the CONTAINER's background showing through a 1px gap
// between cells, rather than a border on each cell. Bordering each cell doubles
// every interior line and leaves the outer edge a pixel thicker than the rest —
// the gap technique gives one hairline everywhere, including where cells meet.
//
// The grid renders whole Monday-start weeks, so most months show spill days from
// the adjacent months. Spill cells are dimmed but still hold their Posts — a
// Post scheduled Aug 1 is visible in the July grid's last row rather than
// disappearing into a gap.
//
// The anchored month arrives as a prop: the Board owns the period so the stepper
// can sit in the shared header row alongside the view switcher.

export type MonthGridProps = Pick<
  PostCardProps,
  "onEditField" | "onEditHashtags" | "onEditSlide" | "onApprove" | "onPublish"
> & {
  posts: SerializedPost[];
  anchor: Date;
  today: string;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function MonthGrid({ posts, anchor, today, ...editing }: MonthGridProps) {
  // Held as an id, not the Post itself, so the drawer always renders the current
  // version of a Post after an edit revalidates rather than a stale copy
  // captured at click time.
  const [openId, setOpenId] = useState<string | null>(null);
  const openPost = posts.find((p) => p.id === openId) ?? null;

  const days = monthGridDays(anchor);
  const buckets = bucketByDate(posts, (p) => p.scheduledDate);
  const visible = days.reduce((n, d) => n + (buckets.get(dateKey(d))?.length ?? 0), 0);
  const todayKey = dateKey(new Date(today));

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return (
    <section aria-label="Month grid" className="flex flex-col gap-1">
      {visible === 0 ? (
        <p className="mb-2 rounded border border-dashed border-border px-4 py-3 text-body-lg text-muted">
          Nothing scheduled this month yet — generate a week from the dashboard
          when you&rsquo;re ready.
        </p>
      ) : null}

      {/* Presentational: every cell below already carries its full date ("Jul
          6") as its accessible name, so announcing a column header on top of
          that would read the weekday twice. */}
      <div aria-hidden="true" className="grid grid-cols-7 px-px">
        {WEEKDAYS.map((d) => (
          <span key={d} className="px-2 text-label-lg font-bold uppercase text-muted">
            {d}
          </span>
        ))}
      </div>

      {/* `bg-border` is the gridline color: the 1px gaps between cells let it
          through, and the container's own border closes the outer edge. */}
      <div
        role="grid"
        aria-label="Month"
        className="grid grid-cols-7 gap-px overflow-hidden rounded border border-border bg-border"
      >
        {weeks.map((week) => (
          // `display: contents` — the row exists for ARIA (a grid's children
          // must be rows) but contributes no box, so all 35-42 cells still
          // participate in the one 7-column grid that draws the gridlines.
          <div role="row" key={dateKey(week[0])} className="contents">
            {week.map((day) => (
              <DayCell
                key={dateKey(day)}
                day={day}
                inMonth={isSameMonth(day, anchor)}
                isToday={dateKey(day) === todayKey}
                posts={buckets.get(dateKey(day)) ?? []}
                onOpen={setOpenId}
              />
            ))}
          </div>
        ))}
      </div>

      {openPost ? (
        <PostDrawer post={openPost} onClose={() => setOpenId(null)} {...editing} />
      ) : null}
    </section>
  );
}

function DayCell({
  day,
  inMonth,
  isToday,
  posts,
  onOpen,
}: {
  day: Date;
  inMonth: boolean;
  isToday: boolean;
  posts: SerializedPost[];
  onOpen: (postId: string) => void;
}) {
  return (
    <div
      role="gridcell"
      aria-label={cellLabel(day)}
      className={`flex min-h-[104px] flex-col gap-1 p-1.5 ${
        inMonth ? "bg-surface-raised" : "bg-surface"
      }`}
    >
      {/* The day number is right-aligned and today's is a filled disc — the one
          piece of chrome that has to be findable without reading anything. */}
      <div className="flex justify-end">
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-pill text-body-xs ${
            isToday
              ? "bg-accent font-bold text-on-accent"
              : inMonth
                ? "text-muted"
                : "text-muted opacity-45"
          }`}
        >
          {day.getUTCDate()}
        </span>
      </div>

      {posts.map((post) => {
        const failed = postState(post) === "failed";
        return (
          <button
            key={post.id}
            type="button"
            onClick={() => onOpen(post.id)}
            className={`flex w-full flex-col gap-[3px] rounded-sm border bg-surface px-[7px] py-1.5 text-left hover:border-accent ${
              failed ? "border-dashed border-danger/50" : "border-border"
            }`}
          >
            <PostSummary post={post} />
          </button>
        );
      })}
    </div>
  );
}
