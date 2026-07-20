"use client";

import { useState } from "react";
import type { SerializedPost } from "@/lib/posts";
import {
  addMonths,
  bucketByDate,
  cellLabel,
  dateKey,
  isSameMonth,
  monthGridDays,
  monthLabel,
} from "@/lib/calendar";
import type { PostCardProps } from "./post-card";
import { PeriodNav } from "./period-nav";
import { PostSummary } from "./post-badges";
import { PostDrawer } from "./post-drawer";

// The month-grid mode (issue #9) — a month at a glance, Posts placed on their
// scheduled dates. A cell displays; clicking it opens the drawer, because editing
// full caption and slide copy inside a small calendar square is impractical, so
// a cell carries a compact summary only.
//
// The grid renders whole Monday-start weeks, so most months show spill days
// from the adjacent months. Spill cells are dimmed but still hold their Posts —
// a Post scheduled Aug 1 is visible in the July grid's last row rather than
// disappearing into a gap.

export type MonthGridProps = Pick<
  PostCardProps,
  "onEditField" | "onEditHashtags" | "onEditSlide" | "onApprove" | "onPublish"
> & {
  posts: SerializedPost[];
  today: string;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function MonthGrid({ posts, today, ...editing }: MonthGridProps) {
  const [offset, setOffset] = useState(0);
  // Held as an id, not the Post itself, so the drawer always renders the
  // current version of a Post after an edit revalidates rather than a stale
  // copy captured at click time.
  const [openId, setOpenId] = useState<string | null>(null);
  const openPost = posts.find((p) => p.id === openId) ?? null;
  const anchor = addMonths(new Date(today), offset);
  const days = monthGridDays(anchor);
  const buckets = bucketByDate(posts, (p) => p.scheduledDate);
  const visible = days.reduce((n, d) => n + (buckets.get(dateKey(d))?.length ?? 0), 0);

  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return (
    <section aria-label="Month grid" className="flex flex-col gap-4">
      <PeriodNav
        label={monthLabel(anchor)}
        previousLabel="Previous month"
        nextLabel="Next month"
        onStep={(n) => setOffset((o) => o + n)}
      />

      {visible === 0 ? (
        <p className="text-sm text-muted">No posts scheduled this month.</p>
      ) : null}

      <div role="grid" className="flex flex-col gap-px rounded border border-border">
        <div role="row" className="grid grid-cols-7">
          {WEEKDAYS.map((d) => (
            <span
              key={d}
              role="columnheader"
              className="px-2 py-1 text-center text-xs font-bold uppercase tracking-wider text-muted"
            >
              {d}
            </span>
          ))}
        </div>
        {weeks.map((week) => (
          <div role="row" key={dateKey(week[0])} className="grid grid-cols-7">
            {week.map((day) => (
              <DayCell
                key={dateKey(day)}
                day={day}
                inMonth={isSameMonth(day, anchor)}
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
  posts,
  onOpen,
}: {
  day: Date;
  inMonth: boolean;
  posts: SerializedPost[];
  onOpen: (postId: string) => void;
}) {
  return (
    <div
      role="gridcell"
      aria-label={cellLabel(day)}
      className={`flex min-h-24 flex-col gap-1 border border-border p-1 ${
        inMonth ? "bg-surface-raised" : "bg-surface"
      }`}
    >
      <span className={`text-xs ${inMonth ? "text-text" : "text-muted"}`}>
        {day.getUTCDate()}
      </span>
      {posts.map((post) => (
        <button
          key={post.id}
          type="button"
          onClick={() => onOpen(post.id)}
          className="rounded-sm border border-border bg-surface-raised p-1 hover:border-accent focus:outline focus:outline-1 focus:outline-accent"
        >
          <PostSummary post={post} />
        </button>
      ))}
    </div>
  );
}
