import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ClientList } from "@/app/client-list";
import type { Client } from "@/generated/prisma/client";

// Issue #3 — the Client list. A thin presentational component: given the
// clients, it renders each clinic and a link through to it. Behavior is
// verified through the rendered output (names visible, links present), not
// through how the list is fetched.

afterEach(() => cleanup());

function fakeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: "c1",
    name: "Lakeside Dental",
    location: null,
    audience: null,
    brandVoice: null,
    colors: null,
    logoUrl: null,
    pillarMon: "Patient Education",
    pillarWed: "Trust & Clinic Branding",
    pillarFri: "Engagement / Fun",
    createdAt: new Date("2026-07-19T00:00:00Z"),
    ...overrides,
  };
}

describe("ClientList", () => {
  it("renders every clinic and a link through to each one", () => {
    const clients = [
      fakeClient({ id: "c1", name: "Lakeside Dental" }),
      fakeClient({ id: "c2", name: "Smile Studio" }),
    ];

    render(<ClientList clients={clients} />);

    // both clinics are visible
    expect(screen.getByText("Lakeside Dental")).toBeInTheDocument();
    expect(screen.getByText("Smile Studio")).toBeInTheDocument();

    // each links through to its own detail page
    const link1 = screen.getByRole("link", { name: /Lakeside Dental/i });
    const link2 = screen.getByRole("link", { name: /Smile Studio/i });
    expect(link1).toHaveAttribute("href", "/clients/c1");
    expect(link2).toHaveAttribute("href", "/clients/c2");
  });

  it("shows an empty-state prompt when there are no clients yet", () => {
    render(<ClientList clients={[]} />);
    expect(screen.getByText(/no clients/i)).toBeInTheDocument();
  });
});