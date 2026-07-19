import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ClientDashboard, type DraftPost, type GenerateResult } from "@/app/clients/[id]/dashboard";
import type { Client } from "@/generated/prisma/client";

// Issue #6 — the Client dashboard. A client component that shows the clinic's
// identity, a "Generate this week" button, and honestly handles every
// generation state: pending (no double-submit), success (three drafts),
// partial success (warnings naming posts to regenerate), failure (readable
// error), and missing-prerequisites (blocked).
//
// Generation is triggered through an injected `onGenerate(clientId)` prop —
// the page wires it to the real server action, these tests inject a fake so
// behavior is verified through the public interface, independent of Ollama.

type Identity = Pick<Client, "id" | "name" | "logoUrl" | "colors">;

function fakeClient(overrides: Partial<Identity> = {}): Identity {
  return {
    id: "c1",
    name: "Lakeside Dental",
    logoUrl: "https://example.com/logo.png",
    colors: "#0A6E7C",
    ...overrides,
  };
}

const noopGenerate = async (): Promise<GenerateResult> => ({
  ok: false,
  error: "unused",
});

function draft(overrides: Partial<DraftPost> = {}): DraftPost {
  return {
    id: "p1",
    topic: "Why bleeding gums are not normal",
    pillar: "Patient Education",
    format: "carousel",
    scheduledDate: "2026-07-20T09:00:00.000Z",
    ...overrides,
  };
}

afterEach(() => cleanup());

describe("ClientDashboard: clinic identity", () => {
  it("shows the clinic name, logo, and brand accent", () => {
    render(
      <ClientDashboard
        client={fakeClient()}
        blockedReason={null}
        onGenerate={noopGenerate}
      />,
    );

    expect(screen.getByText("Lakeside Dental")).toBeInTheDocument();

    const logo = screen.getByRole("img", { name: /lakeside dental/i });
    expect(logo).toHaveAttribute("src", "https://example.com/logo.png");

    // brand accent is surfaced (the client's colors drive the accent swatch)
    expect(screen.getByLabelText(/brand accent/i)).toBeInTheDocument();
    expect(screen.getByText("#0A6E7C")).toBeInTheDocument();
  });

  it("renders a 'Generate this week' button", () => {
    render(
      <ClientDashboard
        client={fakeClient()}
        blockedReason={null}
        onGenerate={noopGenerate}
      />,
    );

    expect(
      screen.getByRole("button", { name: /generate this week/i }),
    ).toBeEnabled();
  });

  it("when blocked, surfaces the missing-prerequisite reason and disables the button", () => {
    render(
      <ClientDashboard
        client={fakeClient()}
        blockedReason={"Wednesday pillar is missing — add it before generating."}
        onGenerate={noopGenerate}
      />,
    );

    expect(
      screen.getByText(/wednesday pillar is missing/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /generate this week/i }),
    ).toBeDisabled();
  });

  it("while generating, shows a pending state and does not double-submit", async () => {
    let resolveGen: (r: GenerateResult) => void = () => {};
    const calls: string[] = [];
    const onGenerate = (clientId: string) =>
      new Promise<GenerateResult>((resolve) => {
        calls.push(clientId);
        resolveGen = resolve;
      });

    render(
      <ClientDashboard
        client={fakeClient()}
        blockedReason={null}
        onGenerate={onGenerate}
      />,
    );

    const button = screen.getByRole("button", { name: /generate this week/i });
    fireEvent.click(button);
    // a rapid second click must NOT trigger a second generation
    fireEvent.click(button);

    // pending status is shown and the button is disabled while it runs
    expect(await screen.findByRole("status")).toHaveTextContent(/generating/i);
    expect(
      screen.getByRole("button", { name: /generat/i }),
    ).toBeDisabled();

    // only the first click reached onGenerate — no double-submit
    expect(calls).toEqual(["c1"]);

    resolveGen({
      ok: true,
      plan: { id: "pl1", label: "Week of 2026-07-20" },
      posts: [],
      warnings: [],
    });
  });

  it("on success, lists the generated drafts with topic, pillar, format, and scheduled date", async () => {
    const posts: DraftPost[] = [
      draft({
        id: "p1",
        topic: "Why bleeding gums are not normal",
        pillar: "Patient Education",
        format: "carousel",
        scheduledDate: "2026-07-20T09:00:00.000Z",
      }),
      draft({
        id: "p2",
        topic: "Meet the team — 20 years caring for Austin",
        pillar: "Trust & Clinic Branding",
        format: "infographic",
        scheduledDate: "2026-07-22T09:00:00.000Z",
      }),
      draft({
        id: "p3",
        topic: "Flossing challenge — can you do it blindfolded?",
        pillar: "Engagement / Fun",
        format: "reel",
        scheduledDate: "2026-07-24T09:00:00.000Z",
      }),
    ];
    const onGenerate = async (): Promise<GenerateResult> => ({
      ok: true,
      plan: { id: "pl1", label: "Week of 2026-07-20" },
      posts,
      warnings: [],
    });

    render(
      <ClientDashboard
        client={fakeClient()}
        blockedReason={null}
        onGenerate={onGenerate}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /generate this week/i }));

    // all three drafts appear with their topic, pillar, format, and scheduled date
    await screen.findByText("Why bleeding gums are not normal");
    expect(screen.getByText("Meet the team — 20 years caring for Austin")).toBeInTheDocument();
    expect(screen.getByText("Flossing challenge — can you do it blindfolded?")).toBeInTheDocument();

    expect(screen.getByText("Patient Education")).toBeInTheDocument();
    expect(screen.getByText("Trust & Clinic Branding")).toBeInTheDocument();
    expect(screen.getByText("Engagement / Fun")).toBeInTheDocument();

    expect(screen.getByText("carousel")).toBeInTheDocument();
    expect(screen.getByText("infographic")).toBeInTheDocument();
    expect(screen.getByText("reel")).toBeInTheDocument();

    expect(screen.getByText("2026-07-20")).toBeInTheDocument();
    expect(screen.getByText("2026-07-22")).toBeInTheDocument();
    expect(screen.getByText("2026-07-24")).toBeInTheDocument();
  });

  it("on partial success, surfaces warnings naming the post(s) that need regeneration", async () => {
    const onGenerate = async (): Promise<GenerateResult> => ({
      ok: true,
      plan: { id: "pl1", label: "Week of 2026-07-20" },
      posts: [
        draft({ id: "p1", topic: "Why bleeding gums are not normal" }),
      ],
      warnings: [
        `Copywriter failed for "Meet the team" — regenerate this post`,
      ],
    });

    render(
      <ClientDashboard
        client={fakeClient()}
        blockedReason={null}
        onGenerate={onGenerate}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /generate this week/i }));

    // the warning is surfaced and names the post that needs regeneration
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/copywriter failed for "meet the team"/i);
    expect(alert).toHaveTextContent(/regenerate this post/i);
  });

  it("on failure, shows a readable error and leaves the dashboard usable (button re-enabled)", async () => {
    const onGenerate = async (): Promise<GenerateResult> => ({
      ok: false,
      error: "Generation failed: planner did not return valid output.",
    });

    render(
      <ClientDashboard
        client={fakeClient()}
        blockedReason={null}
        onGenerate={onGenerate}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /generate this week/i }));

    // readable error shown
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/generation failed/i);
    expect(alert).toHaveTextContent(/planner did not return/i);

    // the dashboard is still usable — the button is enabled again
    expect(
      screen.getByRole("button", { name: /generate this week/i }),
    ).toBeEnabled();
  });
});