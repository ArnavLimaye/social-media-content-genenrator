import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { Board } from "@/app/clients/[id]/board/board";
import type { SerializedPost } from "@/lib/posts";

// Issue #8 — the Board: a per-Client kanban grouping that Client's Posts into
// Draft / Approved / Published columns. Tested through the public interface
// with injected no-op edit callbacks (the page wires real server actions).
// Token-derived classes only (ADR-0003).

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

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Board: kanban groups Posts by status", () => {
  it("lands each Post in the column matching its status", () => {
    const posts = [
      fakePost({ id: "p1", topic: "Draft post A", status: "draft" }),
      fakePost({ id: "p2", topic: "Approved post B", status: "approved" }),
      fakePost({ id: "p3", topic: "Published post C", status: "published" }),
    ];

    render(<Board posts={posts} {...noopProps} />);

    const draft = within(screen.getByRole("region", { name: "Draft" }));
    const approved = within(screen.getByRole("region", { name: "Approved" }));
    const published = within(screen.getByRole("region", { name: "Published" }));

    expect(draft.getByText("Draft post A")).toBeInTheDocument();
    expect(approved.getByText("Approved post B")).toBeInTheDocument();
    expect(published.getByText("Published post C")).toBeInTheDocument();

    // and not in the wrong columns
    expect(draft.queryByText("Approved post B")).not.toBeInTheDocument();
    expect(approved.queryByText("Draft post A")).not.toBeInTheDocument();
  });

  it("renders a column even when it has no posts (so the pipeline shape is always visible)", () => {
    render(<Board posts={[fakePost({ status: "draft" })]} {...noopProps} />);
    expect(screen.getByRole("region", { name: "Approved" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Published" })).toBeInTheDocument();
  });
});

describe("Board: each editable field is uniquely addressable", () => {
  it("does not repeat an aria-label across cards — every input names its own Post", () => {
    // A kanban column holds many Posts, each with a 'Hook' and a 'Slide 1
    // heading'. If those labels repeat verbatim, screen-reader users (and
    // tests) cannot tell which Post a field belongs to — the label has to
    // carry the Post's identity, not just the field name.
    const posts = [
      fakePost({ id: "p1", topic: "Draft post A" }),
      fakePost({ id: "p2", topic: "Draft post B" }),
    ];

    const { container } = render(<Board posts={posts} {...noopProps} />);

    const labels = Array.from(container.querySelectorAll("input[aria-label]")).map((i) =>
      i.getAttribute("aria-label"),
    );
    expect(labels.length).toBeGreaterThan(0);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe("Board: per-Client branding costs zero component changes", () => {
  it("the pillar badge paints from the accent token, so a BrandOverlay rebrands it", () => {
    // The Board takes no color prop. The pillar badge inside each card uses
    // `text-accent` / `bg-accent/10`, which read --color-accent. The wrapping
    // <BrandOverlay> redefines that var per Client (proven in
    // brand-overlay.spec.tsx) — so this class is the whole contract.
    render(<Board posts={[fakePost({ pillar: "Patient Education" })]} {...noopProps} />);

    const pillarBadge = screen.getByText("Patient Education");
    expect(pillarBadge.className).toMatch(/text-accent/);
    expect(pillarBadge.className).toMatch(/bg-accent/);
  });
});