import { describe, it, expect } from "vitest";
import { canApprove, canTransition, isEditable } from "@/lib/post-status";

// Issue #10 — the status lifecycle and the review-flag approval gate.
//
// There is no fact-check agent in v1, so human review *is* the medical-accuracy
// safeguard. This module makes that review a required action rather than an
// optional one, as pure logic: no database, no UI. A Post carrying review flags
// cannot reach `approved` until an operator has explicitly acknowledged them.

// A clean draft: copy present, no flags. Approves in one click.
const cleanDraft = {
  status: "draft",
  hook: "Most people ignore the first sign.",
  caption: "Bleeding gums are not something to wait out.",
  cta: "Book a checkup",
  slides: [],
  reviewFlags: [],
  flagsAcknowledgedAt: null,
};

describe("canApprove: the review-flag acknowledgment gate", () => {
  it("approves a draft with no review flags without any acknowledgment", () => {
    expect(canApprove(cleanDraft, false)).toBe(true);
  });

  it("refuses a flagged draft until the operator acknowledges", () => {
    const flagged = {
      ...cleanDraft,
      reviewFlags: [
        { claim: "Whitening is completely safe for everyone", reason: "absolute safety claim" },
      ],
    };

    expect(canApprove(flagged, false)).toBe(false);
    expect(canApprove(flagged, true)).toBe(true);
  });

  it("does not ask again once the flags have already been acknowledged", () => {
    // The gate is a one-time human checkpoint, not a per-click confirmation:
    // a Post carrying `flagsAcknowledgedAt` approves in one click like clean copy.
    const alreadyReviewed = {
      ...cleanDraft,
      reviewFlags: [{ claim: "Painless in every case", reason: "unqualified claim" }],
      flagsAcknowledgedAt: "2026-07-20T10:00:00.000Z",
    };

    expect(canApprove(alreadyReviewed, false)).toBe(true);
  });

  it("refuses a generation-failed Post, acknowledged or not", () => {
    // A topic-only Post is stored as a draft with every copy field null
    // (lib/generate-week.ts). Approving one would queue a slot with no caption,
    // no slides, and no CTA. The route out is regeneration (#11), not approval.
    const failed = {
      ...cleanDraft,
      hook: null,
      caption: null,
      cta: null,
      slides: null,
    };

    expect(canApprove(failed, false)).toBe(false);
    expect(canApprove(failed, true)).toBe(false);
  });

  it("refuses a Post that is not a draft — approval is a draft-only move", () => {
    expect(canApprove({ ...cleanDraft, status: "approved" }, true)).toBe(false);
    expect(canApprove({ ...cleanDraft, status: "published" }, true)).toBe(false);
  });
});

// The lifecycle is a one-way street: draft → approved → published. There is no
// "rejected" status — a bad draft is fixed by editing or regenerating (#11) —
// and nothing walks back, because a published Post is a record of what went out.
describe("canTransition: the lifecycle table", () => {
  it("allows only the two forward steps", () => {
    expect(canTransition("draft", "approved")).toBe(true);
    expect(canTransition("approved", "published")).toBe(true);
  });

  it("rejects skipping review — draft cannot publish directly", () => {
    expect(canTransition("draft", "published")).toBe(false);
  });

  it("rejects walking a published Post back", () => {
    expect(canTransition("published", "approved")).toBe(false);
    expect(canTransition("published", "draft")).toBe(false);
  });

  it("rejects un-approving and self-transitions", () => {
    expect(canTransition("approved", "draft")).toBe(false);
    expect(canTransition("draft", "draft")).toBe(false);
  });
});

describe("isEditable: published Posts are a read-only record", () => {
  it("allows editing a draft or an approved Post", () => {
    expect(isEditable("draft")).toBe(true);
    expect(isEditable("approved")).toBe(true);
  });

  it("refuses a published Post — what went out must not be silently altered", () => {
    expect(isEditable("published")).toBe(false);
  });
});
