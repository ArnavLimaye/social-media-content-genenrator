import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { PostCard, type PostCardProps } from "@/app/clients/[id]/board/post-card";
import type { SerializedPost } from "@/lib/posts";

// Issue #10 — the approval gate as the operator meets it. The rules are already
// proven as pure logic (tests/post-status.spec.ts) and enforced at the data
// layer (tests/post-lifecycle.spec.ts); what these tests cover is the part
// neither of those can: that the UI actually makes review a *required* action.
//
// Design-lock §3 settles the shape — "Approve…" opens a dialog listing every
// flag, and confirm stays disabled until an acknowledgment checkbox is ticked.
// Callbacks are injected fakes, so the gate is verified without a database.

function fakePost(overrides: Partial<SerializedPost> = {}): SerializedPost {
  return {
    id: "p1",
    clientId: "c1",
    planId: "pl1",
    pillar: "Patient Education",
    format: "carousel",
    topic: "Why bleeding gums are not normal — 3 causes",
    objective: "Teach patients to recognise gingivitis early",
    hook: "Bleeding gums are not a flex.",
    caption: "Most people brush past bleeding gums. Don't.",
    cta: "Book a checkup at the link in bio.",
    slides: [
      { heading: "Bleeding gums? Read this", description: "3 causes", imageIdeas: [] },
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

const twoFlags = [
  {
    claim: "Whitening is completely safe for everyone",
    reason: "absolute safety claim, needs clinician review",
  },
  {
    claim: "Results last a lifetime",
    reason: "unsupported durability claim",
  },
];

function renderCard(post: SerializedPost, over: Partial<PostCardProps> = {}) {
  const props = {
    onEditField: vi.fn(),
    onEditHashtags: vi.fn(),
    onEditSlide: vi.fn(),
    onApprove: vi.fn(),
    onPublish: vi.fn(),
    ...over,
  };
  render(<PostCard post={post} {...props} />);
  return props;
}

afterEach(cleanup);

describe("Approval gate: clean copy is not slowed down", () => {
  it("approves a Post with no review flags in one click", () => {
    const { onApprove } = renderCard(fakePost());

    fireEvent.click(screen.getByRole("button", { name: /approve/i }));

    // straight through — no dialog, no acknowledgment
    expect(onApprove).toHaveBeenCalledWith("p1", false);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("Approval gate: a flagged Post requires explicit acknowledgment", () => {
  const flagged = () => fakePost({ reviewFlags: twoFlags });

  it("does not approve on the first click — it opens a confirmation instead", () => {
    const { onApprove } = renderCard(flagged());

    fireEvent.click(screen.getByRole("button", { name: /approve/i }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onApprove).not.toHaveBeenCalled();
  });

  it("lists every flagged claim with its reason", () => {
    // A claim without its reason gives the operator nothing to act on
    // (design-lock §3), so both halves of every flag must be present.
    renderCard(flagged());
    fireEvent.click(screen.getByRole("button", { name: /approve/i }));

    const dialog = screen.getByRole("dialog");
    for (const flag of twoFlags) {
      expect(dialog).toHaveTextContent(flag.claim);
      expect(dialog).toHaveTextContent(flag.reason);
    }
  });

  it("keeps confirm disabled until the acknowledgment is ticked", () => {
    renderCard(flagged());
    fireEvent.click(screen.getByRole("button", { name: /approve/i }));

    const confirm = screen.getByRole("button", { name: /approve post/i });
    expect(confirm).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox"));
    expect(confirm).toBeEnabled();
  });

  it("approves with acknowledgment once confirmed", () => {
    const { onApprove } = renderCard(flagged());
    fireEvent.click(screen.getByRole("button", { name: /approve/i }));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /approve post/i }));

    expect(onApprove).toHaveBeenCalledWith("p1", true);
  });

  it("writes nothing when the operator declines", () => {
    const { onApprove } = renderCard(flagged());
    fireEvent.click(screen.getByRole("button", { name: /approve/i }));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onApprove).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not ask again once the flags carry an acknowledgment timestamp", () => {
    const { onApprove } = renderCard(
      fakePost({
        reviewFlags: twoFlags,
        flagsAcknowledgedAt: "2026-07-20T10:00:00.000Z",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: /approve/i }));

    expect(onApprove).toHaveBeenCalledWith("p1", false);
  });
});

describe("Publishing and the read-only record", () => {
  it("marks an approved Post published", () => {
    const { onPublish } = renderCard(fakePost({ status: "approved" }));

    fireEvent.click(screen.getByRole("button", { name: /publish/i }));

    expect(onPublish).toHaveBeenCalledWith("p1");
  });

  it("offers no approve action on an approved Post — the lifecycle is one way", () => {
    renderCard(fakePost({ status: "approved" }));
    expect(screen.queryByRole("button", { name: /approve/i })).toBeNull();
  });

  it("renders a published Post as static text with no editable fields", () => {
    renderCard(
      fakePost({ status: "published", publishedAt: "2026-07-22T09:00:00.000Z" }),
    );

    // every inline field is gone — the copy is still readable, just not editable
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.getByText(/Most people brush past bleeding gums/)).toBeInTheDocument();
    expect(screen.getByText("#dentalcare")).toBeInTheDocument();
  });

  it("offers no lifecycle actions on a published Post", () => {
    renderCard(fakePost({ status: "published" }));

    expect(screen.queryByRole("button", { name: /approve/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /publish/i })).toBeNull();
  });

  it("offers no approve action on a generation-failed Post", () => {
    // Topic-only: the copywriter produced nothing. The way out is regeneration
    // (#11), not approving an empty slot.
    renderCard(fakePost({ hook: null, caption: null, cta: null, slides: null }));

    expect(screen.queryByRole("button", { name: /approve/i })).toBeNull();
  });
});

// Design-lock §3: once acknowledged, the flag treatment changes state rather
// than disappearing. The flags are still there and still worth seeing — what
// changed is that a human has signed off on them.
describe("Acknowledged flags read as reviewed", () => {
  const reviewed = () =>
    fakePost({
      reviewFlags: twoFlags,
      flagsAcknowledgedAt: "2026-07-20T10:00:00.000Z",
    });

  it("labels the flag badge as reviewed, keeping the count", () => {
    renderCard(reviewed());
    expect(screen.getByRole("button", { name: /2 reviewed/i })).toBeInTheDocument();
  });

  it("still lists the claims when the badge is expanded", () => {
    // Acknowledgment is not erasure — the operator must be able to re-read what
    // was signed off on.
    renderCard(reviewed());
    fireEvent.click(screen.getByRole("button", { name: /2 reviewed/i }));
    expect(screen.getByText(twoFlags[0].claim, { exact: false })).toBeInTheDocument();
  });

  it("notes the flags as reviewed in the footer", () => {
    renderCard(reviewed());
    expect(screen.getByText("Flags reviewed")).toBeInTheDocument();
  });

  it("still shows the unreviewed badge while flags are unacknowledged", () => {
    renderCard(fakePost({ reviewFlags: twoFlags }));
    expect(screen.getByRole("button", { name: /2 flags/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reviewed/i })).toBeNull();
  });
});
