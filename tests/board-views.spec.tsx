import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { Board } from "@/app/clients/[id]/board/board";
import type { SerializedPost } from "@/lib/posts";

// Issue #9 — the Board's calendar modes: a view toggle between the kanban from
// #8, a week list, and a month grid, both driven by `scheduledDate`. Tested
// through the public interface with injected edit callbacks (the page wires
// real server actions), and with an explicit `today` so the anchored period is
// deterministic regardless of when the suite runs.

function fakePost(overrides: Partial<SerializedPost> = {}): SerializedPost {
  return {
    id: "p1",
    clientId: "c1",
    planId: "pl1",
    pillar: "Patient Education",
    format: "carousel",
    topic: "Why bleeding gums are not normal",
    objective: "Teach patients to recognise gingivitis early",
    hook: "Bleeding gums are not a flex.",
    caption: "Don't brush past bleeding gums.",
    cta: "Book a checkup.",
    slides: [
      {
        heading: "Bleeding gums? Read this",
        description: "3 causes you can spot at home",
        imageIdeas: [{ type: "photo", idea: "gumline" }],
      },
    ],
    hashtags: ["#dentalcare"],
    reviewFlags: null,
    scheduledDate: "2026-07-22T09:00:00.000Z",
    status: "draft",
    publishedAt: null,
    flagsAcknowledgedAt: null,
    imagePath: null,
    plannerPromptTokens: null,
    plannerOutputTokens: null,
    copywriterPromptTokens: null,
    copywriterOutputTokens: null,
    createdAt: "2026-07-20T00:00:00.000Z",
    ...overrides,
  };
}

const noopProps = {
  onEditField: vi.fn(),
  onEditHashtags: vi.fn(),
  onEditSlide: vi.fn(),
};

// A Monday, so the anchored week is Jul 20 (Mon) / 22 (Wed) / 24 (Fri).
const TODAY = "2026-07-20T09:00:00.000Z";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  // The Board records the selected view in localStorage, which outlives a
  // render — without this, one test's toggle click decides the next test's
  // opening mode.
  window.localStorage.clear();
});

describe("Board: view toggle", () => {
  it("switches between kanban, week list, and month grid", () => {
    render(<Board posts={[fakePost()]} today={TODAY} {...noopProps} />);

    // kanban is the default mode — the Board opens where #8 left it
    expect(screen.getByRole("region", { name: "Draft" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Week" }));
    expect(screen.getByRole("region", { name: "Week list" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Draft" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Month" }));
    expect(screen.getByRole("region", { name: "Month grid" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Week list" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Kanban" }));
    expect(screen.getByRole("region", { name: "Draft" })).toBeInTheDocument();
  });
});

// Renders the Board already switched to a mode, so each test states the mode it
// is about rather than repeating the toggle click.
function renderBoard(
  posts: SerializedPost[],
  mode: "Week" | "Month",
  today = TODAY,
) {
  const result = render(<Board posts={posts} today={today} {...noopProps} />);
  fireEvent.click(screen.getByRole("button", { name: mode }));
  return result;
}

describe("Board: week list places Posts on their scheduled dates", () => {
  it("puts each Post on its own Mon/Wed/Fri row", () => {
    const posts = [
      fakePost({ id: "p1", topic: "Monday post", scheduledDate: "2026-07-20T09:00:00.000Z" }),
      fakePost({ id: "p2", topic: "Wednesday post", scheduledDate: "2026-07-22T09:00:00.000Z" }),
      fakePost({ id: "p3", topic: "Friday post", scheduledDate: "2026-07-24T09:00:00.000Z" }),
    ];

    renderBoard(posts, "Week");

    const mon = within(screen.getByRole("region", { name: "Mon · Jul 20" }));
    const wed = within(screen.getByRole("region", { name: "Wed · Jul 22" }));
    const fri = within(screen.getByRole("region", { name: "Fri · Jul 24" }));

    expect(mon.getByText("Monday post")).toBeInTheDocument();
    expect(wed.getByText("Wednesday post")).toBeInTheDocument();
    expect(fri.getByText("Friday post")).toBeInTheDocument();

    // and not on each other's days
    expect(mon.queryByText("Wednesday post")).not.toBeInTheDocument();
    expect(fri.queryByText("Monday post")).not.toBeInTheDocument();
  });

  it("shows only the anchored week — a Post scheduled in another week stays out", () => {
    const posts = [
      fakePost({ id: "p1", topic: "This week", scheduledDate: "2026-07-22T09:00:00.000Z" }),
      fakePost({ id: "p2", topic: "Next week", scheduledDate: "2026-07-29T09:00:00.000Z" }),
    ];

    renderBoard(posts, "Week");

    expect(screen.getByText("This week")).toBeInTheDocument();
    expect(screen.queryByText("Next week")).not.toBeInTheDocument();
  });
});

describe("Board: week list edits inline, matching the kanban", () => {
  it("commits a hook edit through the same injected callback", () => {
    renderBoard([fakePost({ id: "p1", topic: "Gum health" })], "Week");

    const hook = screen.getByLabelText("Hook — Gum health");
    fireEvent.change(hook, { target: { value: "A sharper hook" } });
    fireEvent.blur(hook);

    expect(noopProps.onEditField).toHaveBeenCalledWith("p1", "hook", "A sharper hook");
  });

  it("commits a slide edit through the same injected callback", () => {
    renderBoard([fakePost({ id: "p1", topic: "Gum health" })], "Week");

    const heading = screen.getByLabelText("Slide 1 heading — Gum health");
    fireEvent.change(heading, { target: { value: "Rewritten heading" } });
    fireEvent.blur(heading);

    expect(noopProps.onEditSlide).toHaveBeenCalledWith("p1", 0, "heading", "Rewritten heading");
  });
});

describe("Board: moving between weeks", () => {
  const posts = [
    fakePost({ id: "p1", topic: "Post A", scheduledDate: "2026-07-22T09:00:00.000Z" }),
    fakePost({ id: "p2", topic: "Post B", scheduledDate: "2026-07-29T09:00:00.000Z" }),
  ];

  it("names the anchored week and steps forward and back", () => {
    renderBoard(posts, "Week");
    expect(screen.getByText("Week of Jul 20")).toBeInTheDocument();
    expect(screen.getByText("Post A")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next week" }));
    expect(screen.getByText("Week of Jul 27")).toBeInTheDocument();
    expect(screen.getByText("Post B")).toBeInTheDocument();
    expect(screen.queryByText("Post A")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Previous week" }));
    expect(screen.getByText("Week of Jul 20")).toBeInTheDocument();
    expect(screen.getByText("Post A")).toBeInTheDocument();
  });

  it("reads as intentionally empty when the week has no Posts", () => {
    renderBoard(posts, "Week");
    // two weeks on: no posts scheduled
    fireEvent.click(screen.getByRole("button", { name: "Next week" }));
    fireEvent.click(screen.getByRole("button", { name: "Next week" }));

    // the week still renders its shape — the operator sees an empty schedule,
    // not a blank page that could equally mean a load failure
    expect(screen.getByRole("region", { name: "Mon · Aug 3" })).toBeInTheDocument();
    expect(screen.getByText(/no posts scheduled/i)).toBeInTheDocument();
  });
});

describe("Board: month grid places Posts on their scheduled dates", () => {
  it("puts each Post in the cell for its own day", () => {
    const posts = [
      fakePost({ id: "p1", topic: "Post A", scheduledDate: "2026-07-06T09:00:00.000Z" }),
      fakePost({ id: "p2", topic: "Post B", scheduledDate: "2026-07-22T09:00:00.000Z" }),
    ];

    renderBoard(posts, "Month");

    expect(within(screen.getByRole("gridcell", { name: "Jul 6" })).getByText("Post A")).toBeInTheDocument();
    expect(within(screen.getByRole("gridcell", { name: "Jul 22" })).getByText("Post B")).toBeInTheDocument();
    expect(within(screen.getByRole("gridcell", { name: "Jul 7" })).queryByText("Post A")).not.toBeInTheDocument();
  });

  it("places Posts in the weeks that span a month boundary", () => {
    // July 2026 starts on a Wednesday and ends on a Friday, so the grid opens
    // on Mon Jun 29 and closes on Sun Aug 2. A Post scheduled in either spill
    // still has to land in the cell the operator can see.
    const posts = [
      fakePost({ id: "p1", topic: "Leading spill", scheduledDate: "2026-06-30T09:00:00.000Z" }),
      fakePost({ id: "p2", topic: "Trailing spill", scheduledDate: "2026-08-01T09:00:00.000Z" }),
    ];

    renderBoard(posts, "Month");

    expect(within(screen.getByRole("gridcell", { name: "Jun 30" })).getByText("Leading spill")).toBeInTheDocument();
    expect(within(screen.getByRole("gridcell", { name: "Aug 1" })).getByText("Trailing spill")).toBeInTheDocument();
  });

  it("names the anchored month and steps forward and back", () => {
    const posts = [
      fakePost({ id: "p1", topic: "July post", scheduledDate: "2026-07-22T09:00:00.000Z" }),
      fakePost({ id: "p2", topic: "September post", scheduledDate: "2026-09-16T09:00:00.000Z" }),
    ];

    renderBoard(posts, "Month");
    expect(screen.getByText("July 2026")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByText("August 2026")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByText("September 2026")).toBeInTheDocument();
    expect(screen.getByText("September post")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.getByText("August 2026")).toBeInTheDocument();
  });

  it("renders an empty month as a real calendar, not a broken layout", () => {
    renderBoard([fakePost({ scheduledDate: "2026-07-22T09:00:00.000Z" })], "Month");
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));

    // the August grid is still a full rectangle of day cells
    expect(screen.getByRole("gridcell", { name: "Aug 1" })).toBeInTheDocument();
    expect(screen.getByRole("gridcell", { name: "Aug 31" })).toBeInTheDocument();
    expect(screen.getAllByRole("gridcell").length % 7).toBe(0);
    expect(screen.getByText(/no posts scheduled/i)).toBeInTheDocument();
  });
});

describe("Board: month-grid cells summarise rather than expand", () => {
  const flagged = fakePost({
    id: "p1",
    topic: "Gum health",
    format: "reel",
    status: "approved",
    reviewFlags: [{ claim: "Whitening is safe for everyone", reason: "absolute safety claim" }],
    scheduledDate: "2026-07-22T09:00:00.000Z",
  });

  it("shows topic, format, status, and a flag indicator — not the whole card", () => {
    renderBoard([flagged], "Month");
    const cell = within(screen.getByRole("gridcell", { name: "Jul 22" }));

    expect(cell.getByText("Gum health")).toBeInTheDocument();
    expect(cell.getByText(/reel/i)).toBeInTheDocument();
    expect(cell.getByText(/approved/i)).toBeInTheDocument();
    expect(cell.getByLabelText(/1 review flag/i)).toBeInTheDocument();

    // A cell is an overview: the full copy and its editors belong in the
    // drawer, not inside a calendar square.
    expect(cell.queryByText("Don't brush past bleeding gums.")).not.toBeInTheDocument();
    expect(cell.queryByLabelText(/^Hook —/)).not.toBeInTheDocument();
    expect(cell.queryByLabelText(/^Caption —/)).not.toBeInTheDocument();
  });

  it("shows no flag indicator on an unflagged Post", () => {
    renderBoard([fakePost({ reviewFlags: null, scheduledDate: "2026-07-22T09:00:00.000Z" })], "Month");
    const cell = within(screen.getByRole("gridcell", { name: "Jul 22" }));
    expect(cell.queryByLabelText(/review flag/i)).not.toBeInTheDocument();
  });
});

describe("Board: month grid opens an editor drawer", () => {
  const post = fakePost({
    id: "p1",
    topic: "Gum health",
    scheduledDate: "2026-07-22T09:00:00.000Z",
  });

  it("opens the full card on click, with editing that commits", () => {
    renderBoard([post], "Month");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Gum health/ }));

    const drawer = within(screen.getByRole("dialog", { name: /Gum health/ }));
    // the full card, not the cell summary — the copy fields are all here
    const caption = drawer.getByLabelText("Caption — Gum health");
    fireEvent.change(caption, { target: { value: "Edited in the drawer" } });
    fireEvent.blur(caption);

    expect(noopProps.onEditField).toHaveBeenCalledWith("p1", "caption", "Edited in the drawer");
  });

  it("closes again", () => {
    renderBoard([post], "Month");
    fireEvent.click(screen.getByRole("button", { name: /Gum health/ }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("re-seeds every field when a different Post is opened without closing first", () => {
    // The limitation recorded when #8 closed: InlineText seeds its state from
    // props on mount, so a drawer that stays mounted while a different Post is
    // swapped in would keep showing the previous Post's copy — and the next
    // blur would then write Post A's text onto Post B.
    const posts = [
      fakePost({
        id: "p1",
        topic: "Post A",
        hook: "Hook A",
        caption: "Caption A",
        scheduledDate: "2026-07-20T09:00:00.000Z",
      }),
      fakePost({
        id: "p2",
        topic: "Post B",
        hook: "Hook B",
        caption: "Caption B",
        scheduledDate: "2026-07-22T09:00:00.000Z",
      }),
    ];

    renderBoard(posts, "Month");

    fireEvent.click(screen.getByRole("button", { name: /Post A/ }));
    expect(screen.getByLabelText("Hook — Post A")).toHaveValue("Hook A");
    expect(screen.getByLabelText("Caption — Post A")).toHaveValue("Caption A");

    // open B from the grid while A's drawer is still up
    fireEvent.click(screen.getByRole("button", { name: /Post B/ }));
    expect(screen.getByLabelText("Hook — Post B")).toHaveValue("Hook B");
    expect(screen.getByLabelText("Caption — Post B")).toHaveValue("Caption B");
    expect(screen.queryByLabelText("Hook — Post A")).not.toBeInTheDocument();
  });
});

describe("Board: a Post whose copy generation failed is visible in every view", () => {
  // The orchestrator saves the planner's outline and leaves every copy field
  // null when the copywriter call fails, keeping status "draft". The operator
  // has to be able to spot that gap to regenerate it (#11) — in whichever view
  // they happen to be working in.
  const topicOnly = fakePost({
    id: "p9",
    topic: "Copy never generated",
    hook: null,
    caption: null,
    cta: null,
    slides: null,
    hashtags: null,
    scheduledDate: "2026-07-22T09:00:00.000Z",
  });

  it("marks it in the kanban", () => {
    render(<Board posts={[topicOnly]} today={TODAY} {...noopProps} />);
    const column = within(screen.getByRole("region", { name: "Draft" }));
    expect(column.getByText("Failed")).toBeInTheDocument();
  });

  it("marks it in the week list", () => {
    renderBoard([topicOnly], "Week");
    const day = within(screen.getByRole("region", { name: "Wed · Jul 22" }));
    expect(day.getByText("Failed")).toBeInTheDocument();
  });

  it("marks it in the month grid", () => {
    renderBoard([topicOnly], "Month");
    const cell = within(screen.getByRole("gridcell", { name: "Jul 22" }));
    expect(cell.getByText("Failed")).toBeInTheDocument();
  });

  it("does not mark a Post that has copy", () => {
    renderBoard([fakePost({ scheduledDate: "2026-07-22T09:00:00.000Z" })], "Week");
    expect(screen.queryByText("Failed")).not.toBeInTheDocument();
  });
});

describe("Board: the selected view persists as the operator navigates", () => {
  beforeEach(() => window.localStorage.clear());

  it("opens in the view the URL names", () => {
    render(<Board posts={[]} today={TODAY} urlView="week" {...noopProps} />);
    expect(screen.getByRole("region", { name: "Week list" })).toBeInTheDocument();
  });

  it("restores the stored view when the URL names none", () => {
    // Leaving the Board for the dashboard and coming back drops the query
    // string — the standing preference is what carries the choice across.
    window.localStorage.setItem("board-view", "month");
    render(<Board posts={[]} today={TODAY} {...noopProps} />);
    expect(screen.getByRole("region", { name: "Month grid" })).toBeInTheDocument();
  });

  it("lets an explicit URL override the stored preference", () => {
    window.localStorage.setItem("board-view", "month");
    render(<Board posts={[]} today={TODAY} urlView="week" {...noopProps} />);
    expect(screen.getByRole("region", { name: "Week list" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Month grid" })).not.toBeInTheDocument();
  });

  it("records a switch in both places, so either route back restores it", () => {
    const onViewChange = vi.fn();
    render(<Board posts={[]} today={TODAY} onViewChange={onViewChange} {...noopProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Week" }));

    expect(window.localStorage.getItem("board-view")).toBe("week");
    expect(onViewChange).toHaveBeenCalledWith("week");
  });

  it("falls back to kanban on a junk view rather than rendering no mode at all", () => {
    render(<Board posts={[]} today={TODAY} urlView="gantt" {...noopProps} />);
    expect(screen.getByRole("region", { name: "Draft" })).toBeInTheDocument();
  });
});

describe("Board: the per-Client brand overlay reaches the calendar modes", () => {
  // Same contract as the kanban (#8): no mode takes a color prop. Accent-painted
  // elements name the accent token, and the <BrandOverlay> wrapping the page
  // redefines that variable per Client — so these class names are the whole
  // mechanism, and a mode that hardcoded a color would silently stop rebranding.
  it("paints the week-list day headings from the accent token", () => {
    renderBoard([fakePost({ scheduledDate: "2026-07-22T09:00:00.000Z" })], "Week");
    expect(screen.getByText("Wed · Jul 22").className).toMatch(/text-accent/);
  });

  it("paints the month-cell status badge from the accent token", () => {
    renderBoard(
      [fakePost({ status: "approved", scheduledDate: "2026-07-22T09:00:00.000Z" })],
      "Month",
    );
    const cell = within(screen.getByRole("gridcell", { name: "Jul 22" }));
    expect(cell.getByText("Approved").className).toMatch(/text-accent/);
  });

  it("rebrands the card inside the drawer, which is the same card as everywhere else", () => {
    renderBoard(
      [fakePost({ pillar: "Patient Education", scheduledDate: "2026-07-22T09:00:00.000Z" })],
      "Month",
    );
    fireEvent.click(screen.getByRole("button", { name: /bleeding gums/i }));

    const drawer = within(screen.getByRole("dialog"));
    expect(drawer.getByText("Patient Education").className).toMatch(/text-accent/);
  });
});
