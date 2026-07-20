import { describe, it, expect } from "vitest";
import { postState } from "@/lib/post-state";

// Issue #9 — a Post whose copy generation failed. The orchestrator writes these
// as topic-only Posts: the planner's outline is saved, every copywriter field is
// null, and a warning is surfaced (lib/generate-week.ts). Crucially the `status`
// column stays "draft" — there is no "failed" status in the database — so every
// view has to derive the failed state from the missing copy instead.
describe("postState: deriving the generation-failed state", () => {
  const topicOnly = {
    status: "draft",
    hook: null,
    caption: null,
    cta: null,
    slides: null,
  };

  it("reports a topic-only Post as failed even though its status is draft", () => {
    expect(postState(topicOnly as never)).toBe("failed");
  });

  it("leaves a Post that has copy in its own status", () => {
    expect(
      postState({ ...topicOnly, hook: "A hook", caption: "A caption" } as never),
    ).toBe("draft");
    expect(
      postState({ ...topicOnly, status: "approved", caption: "A caption" } as never),
    ).toBe("approved");
    expect(
      postState({ ...topicOnly, status: "published", slides: [] } as never),
    ).toBe("published");
  });

  it("treats any single surviving copy field as a partial success, not a failure", () => {
    // A copywriter that returned a hook but nothing else did produce copy. The
    // operator should see it and judge, not have it labelled a failed run.
    expect(postState({ ...topicOnly, cta: "Book now" } as never)).toBe("draft");
  });
});
