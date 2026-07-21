"use client";

import type { SerializedPost } from "@/lib/posts";
import { bucketByDate, cellLabel, dateKey, dayLabel } from "@/lib/calendar";
import { scheduleDates, type DayName } from "@/lib/schedule-dates";
import { PostCard, type PostCardProps } from "./post-card";

// The week-list mode — the anchored week's Posts on their Mon/Wed/Fri dates.
// This is the primary working view: it reuses the Post card and supports the
// same inline editing as the kanban.
//
// Each row is a `128px | 1fr` grid: a fixed GUTTER carrying the day, the date,
// and the pillar, with the card beside it. The gutter is why the card can drop
// its own date line and pillar chip in this mode — the row already says both,
// once, in the place the eye scans down.
//
// The three-day Mon/Wed/Fri shape is a hardcoded constant (ADR-0002), so the
// rows come straight from `scheduleDates` — the same helper the orchestrator
// used to assign these dates in the first place. Deriving both from one place is
// what guarantees a Post can never land on a day the week list does not render.
//
// The anchored week arrives as a prop: the Board owns the period so the stepper
// can sit in the shared header row alongside the view switcher.

export type WeekPillars = Record<DayName, string>;

export type WeekListProps = Pick<
  PostCardProps,
  "onEditField" | "onEditHashtags" | "onEditSlide" | "onApprove" | "onPublish"
> & {
  posts: SerializedPost[];
  weekStart: Date;
  // The clinic's pillar per posting day. Needed for the EMPTY days: a day with
  // a Post takes the pillar from the Post itself, but an unfilled slot still has
  // to say what it is for, or the week reads as three interchangeable gaps.
  pillars?: WeekPillars;
};

const DAYS: DayName[] = ["Monday", "Wednesday", "Friday"];

export function WeekList({ posts, weekStart, pillars, ...editing }: WeekListProps) {
  const dates = scheduleDates(weekStart);
  const buckets = bucketByDate(posts, (p) => p.scheduledDate);
  const total = DAYS.reduce((n, day) => n + (buckets.get(dateKey(dates[day]))?.length ?? 0), 0);

  return (
    <section aria-label="Week list" className="flex max-w-[880px] flex-col gap-4">
      {/* An empty week still renders its Mon/Wed/Fri shape below, so this line
          says which of the two empty cases the operator is looking at: a week
          nobody generated yet, rather than a page that failed to load. */}
      {total === 0 ? (
        <p className="rounded border border-border bg-surface-raised px-4 py-3 text-control text-muted">
          This week is open — nothing scheduled yet.
        </p>
      ) : null}

      {DAYS.map((day) => {
        const date = dates[day];
        const dayPosts = buckets.get(dateKey(date)) ?? [];
        return (
          // Each row is its own landmark named for the date it holds, so a
          // screen-reader user can jump between days rather than reading the
          // whole week as one undifferentiated list.
          <section
            key={day}
            aria-label={dayLabel(date)}
            className="grid grid-cols-[128px_minmax(0,1fr)] gap-4"
          >
            <div className="pt-2">
              <h2 className="text-body font-bold uppercase tracking-wider text-text">
                {day}
              </h2>
              <p className="text-body text-muted">{cellLabel(date)}</p>
              {pillars?.[day] ? (
                <p className="mt-1 text-body-sm font-semibold text-accent">
                  {pillars[day]}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-3">
              {dayPosts.map((post) => (
                <PostCard key={post.id} post={post} variant="week" {...editing} />
              ))}
              {dayPosts.length === 0 ? (
                <p className="rounded border border-dashed border-border p-5 text-center text-body-lg text-muted">
                  No post scheduled
                </p>
              ) : null}
            </div>
          </section>
        );
      })}
    </section>
  );
}
