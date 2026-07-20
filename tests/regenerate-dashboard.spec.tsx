import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ClientDashboard, type GenerateResult } from "@/app/clients/[id]/dashboard";
import { PostCard } from "@/app/clients/[id]/board/post-card";
import type { SerializedPost } from "@/lib/posts";
import type { Client } from "@/generated/prisma/client";

// Issue #11 — the dashboard side of Regenerate.
//
// Regenerate is destructive: it throws away drafts the operator may have spent
// time reading. So it must be deliberate — never the same single click as
// "Generate this week", and never vague about how much is being discarded.
// These tests drive the component through its public props with a fake
// `onRegenerate`, exactly as the generation tests drive `onGenerate`.

type Identity = Pick<Client, "id" | "name" | "logoUrl" | "colors">;

function fakeClient(overrides: Partial<Identity> = {}): Identity {
  return {
    id: "c1",
    name: "Lakeside Dental",
    logoUrl: null,
    colors: null,
    ...overrides,
  };
}

const noop = async (): Promise<GenerateResult> => ({ ok: false, error: "unused" });

// The week this dashboard is looking at, as the page hands it over.
function weekPlan(draftCount: number) {
  return { label: "Week of 2026-07-20", draftCount };
}

afterEach(() => cleanup());

describe("ClientDashboard: a week that already has a plan", () => {
  it("offers Regenerate instead of Generate, and says why", () => {
    render(
      <ClientDashboard
        client={fakeClient()}
        blockedReason={null}
        weekPlan={weekPlan(3)}
        onGenerate={noop}
        onRegenerate={noop}
      />,
    );

    // The generate affordance is gone — clicking it would only ever be refused.
    // Anchored: "Regenerate this week" contains "generate this week".
    expect(screen.queryByRole("button", { name: /^generate this week$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /regenerate/i })).toBeInTheDocument();
    // The block and its remedy sit together, so the operator is never told
    // "no" without being told what to do instead.
    expect(screen.getByRole("alert")).toHaveTextContent(/already has a plan/i);
  });

  it("offers Generate, not Regenerate, when the week has no plan", () => {
    render(
      <ClientDashboard
        client={fakeClient()}
        blockedReason={null}
        weekPlan={null}
        onGenerate={noop}
        onRegenerate={noop}
      />,
    );

    expect(screen.getByRole("button", { name: /^generate this week$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /regenerate/i })).not.toBeInTheDocument();
  });
});

describe("ClientDashboard: regenerating is deliberate", () => {
  function renderWith(draftCount: number, onRegenerate = vi.fn(async () => ({ ok: false, error: "x" }) as GenerateResult)) {
    render(
      <ClientDashboard
        client={fakeClient()}
        blockedReason={null}
        weekPlan={weekPlan(draftCount)}
        onGenerate={noop}
        onRegenerate={onRegenerate}
      />,
    );
    return onRegenerate;
  }

  it("does not regenerate on the first click — it asks, and states how many drafts go", () => {
    const onRegenerate = renderWith(2);

    fireEvent.click(screen.getByRole("button", { name: /regenerate this week/i }));

    expect(onRegenerate).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", { name: /confirm regenerate/i });
    // The count is the whole point: "Regenerate this week" alone does not say
    // whether one draft or three is about to be thrown away.
    expect(dialog).toHaveTextContent(/2 drafts/i);
    // And it must answer the question the operator is actually worried about.
    expect(dialog).toHaveTextContent(/approved and published.*kept/i);
  });

  it("counts one draft in the singular", () => {
    renderWith(1);
    fireEvent.click(screen.getByRole("button", { name: /regenerate this week/i }));
    expect(screen.getByRole("dialog")).toHaveTextContent(/1 draft\b/i);
    expect(screen.getByRole("dialog")).not.toHaveTextContent(/1 drafts/i);
  });

  it("cancelling is a true no-op — nothing is discarded and the dialog closes", () => {
    const onRegenerate = renderWith(3);

    fireEvent.click(screen.getByRole("button", { name: /regenerate this week/i }));
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onRegenerate).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // Still offered — cancelling declines this regeneration, not the option.
    expect(screen.getByRole("button", { name: /regenerate this week/i })).toBeInTheDocument();
  });

  it("regenerates once confirmed", () => {
    const onRegenerate = renderWith(3);

    fireEvent.click(screen.getByRole("button", { name: /regenerate this week/i }));
    fireEvent.click(screen.getByRole("button", { name: /replace 3 drafts/i }));

    expect(onRegenerate).toHaveBeenCalledTimes(1);
    expect(onRegenerate).toHaveBeenCalledWith("c1");
  });

  it("regenerates per week, never per post — the drafts it lists carry no regenerate control", async () => {
    const posts = [
      { id: "p1", topic: "A", pillar: "Patient Education", format: "carousel", scheduledDate: "2026-07-20T09:00:00.000Z" },
      { id: "p2", topic: "B", pillar: "Trust & Clinic Branding", format: "reel", scheduledDate: "2026-07-22T09:00:00.000Z" },
    ];
    const onRegenerate = vi.fn(
      async (): Promise<GenerateResult> => ({ ok: true, plan: { id: "pl1", label: "Week of 2026-07-20" }, posts, warnings: [] }),
    );
    render(
      <ClientDashboard
        client={fakeClient()}
        blockedReason={null}
        weekPlan={weekPlan(2)}
        onGenerate={noop}
        onRegenerate={onRegenerate}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /regenerate this week/i }));
    fireEvent.click(screen.getByRole("button", { name: /replace 2 drafts/i }));
    expect(await screen.findByText("A")).toBeInTheDocument();

    // Per-post regeneration is explicitly out of scope for the MVP. The only
    // regenerate control on the screen is the week-level one.
    expect(screen.getAllByRole("button", { name: /regenerate/i })).toHaveLength(1);
  });
});

describe("per-post regeneration stays out of scope", () => {
  // A generation-failed Post is the one place a per-post retry would be
  // tempting. The card marks it — but the mark is a hint pointing at the
  // week-level action, not a control, because regeneration is per week for the
  // MVP. If this ever becomes a button, that decision should be deliberate.
  function failedPost(): SerializedPost {
    return {
      id: "p1",
      clientId: "c1",
      planId: "pl1",
      pillar: "Patient Education",
      format: "carousel",
      topic: "Why bleeding gums are not normal — 3 causes",
      objective: "Teach patients to recognise gingivitis early",
      hook: null,
      caption: null,
      cta: null,
      slides: null,
      hashtags: null,
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
    };
  }

  it("marks a generation-failed post without giving it its own regenerate control", () => {
    render(<PostCard post={failedPost()} />);

    expect(screen.queryByRole("button", { name: /regenerate/i })).not.toBeInTheDocument();
  });
});
