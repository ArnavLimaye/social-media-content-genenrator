"use client";

import { useState } from "react";
import type { SerializedPost } from "@/lib/posts";
import { addWeeks, bucketByDate, dateKey, dayLabel, weekLabel } from "@/lib/calendar";
import { scheduleDates, weekStartFor, type DayName } from "@/lib/schedule-dates";
import { PostCard, type PostCardProps } from "./post-card";
import { PeriodNav } from "./period-nav";

// The week-list mode (issue #9) — the anchored week's Posts listed on their
// Mon/Wed/Fri dates. This is the primary working view: it reuses the Post card
// and supports the same inline editing as the kanban (design-lock §2, as
// amended on #8).
//
// The three-day Mon/Wed/Fri shape is a hardcoded constant (ADR-0002), so the
// rows come straight from `scheduleDates` — the same helper the orchestrator
// used to assign these dates in the first place. Deriving both from one place
// is what guarantees a Post can never land on a day the week list does not
// render.

export type WeekListProps = Pick<
  PostCardProps,
  "onEditField" | "onEditHashtags" | "onEditSlide"
> & {
  posts: SerializedPost[];
  today: string;
};

const DAYS: DayName[] = ["Monday", "Wednesday", "Friday"];

export function WeekList({ posts, today, ...editing }: WeekListProps) {
  // The anchored week, as an offset from the week containing `today`. Held as a
  // number rather than a Date so the state stays serializable and the anchor is
  // always re-derived from one place.
  const [offset, setOffset] = useState(0);
  const weekStart = addWeeks(weekStartFor(new Date(today)), offset);
  const dates = scheduleDates(weekStart);
  const buckets = bucketByDate(posts, (p) => p.scheduledDate);
  const total = DAYS.reduce((n, day) => n + (buckets.get(dateKey(dates[day]))?.length ?? 0), 0);

  return (
    <section aria-label="Week list" className="flex flex-col gap-4">
      <PeriodNav
        label={weekLabel(weekStart)}
        previousLabel="Previous week"
        nextLabel="Next week"
        onStep={(n) => setOffset((o) => o + n)}
      />

      {/* An empty week still renders its Mon/Wed/Fri shape below, so this line
          says which of the two empty cases the operator is looking at: a week
          nobody generated yet, rather than a page that failed to load. */}
      {total === 0 ? (
        <p className="text-sm text-muted">No posts scheduled this week.</p>
      ) : null}

      {DAYS.map((day) => {
        const date = dates[day];
        const label = dayLabel(date);
        const dayPosts = buckets.get(dateKey(date)) ?? [];
        return (
          <section key={day} aria-label={label} className="flex flex-col gap-2">
            <h2 className="text-sm font-bold uppercase tracking-widest text-accent">
              {label}
            </h2>
            <div className="flex flex-col gap-3">
              {dayPosts.map((post) => (
                <PostCard key={post.id} post={post} showDateLine={false} {...editing} />
              ))}
            </div>
          </section>
        );
      })}
    </section>
  );
}
