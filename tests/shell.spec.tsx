import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { lightTokens, darkTokens } from "@/lib/theme/tokens";
import { Shell } from "@/app/shell";

// Behavior C — the application shell renders themed, in both light and dark,
// from the SAME token names.
//
// The shell uses only token-derived utility classes (bg-surface, text-text,
// font-sans, rounded-...), the token CSS is injected into the document, and a
// toggle switches [data-theme] on :root. Crucially the classes do NOT change
// between modes — the token names are identical, only their values flip — which
// is what "light and dark render from the same token names" means.

describe("themed application shell", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
  });

  afterEach(() => {
    cleanup();
  });

  it("renders a shell styled only from tokens, with the token CSS injected", () => {
    render(<Shell>Walking skeleton.</Shell>);

    // the chrome is present
    expect(screen.getByRole("banner")).toBeInTheDocument();
    // The wordmark is one lockup in two weights, so it is two elements:
    // the product name, and its descriptor beside it.
    expect(screen.getByText(/Dental Content/i)).toBeInTheDocument();
    expect(screen.getByText(/back-office/i)).toBeInTheDocument();

    // token-driven classes on the shell surfaces (not hardcoded colors)
    const banner = screen.getByRole("banner");
    expect(banner.className).toMatch(/bg-surface/);
    expect(banner.className).toMatch(/text-text/);
    expect(banner.className).toMatch(/font-sans/);

    // the token CSS is in the document, with both light and dark values
    const style = document.querySelector("style");
    expect(style?.textContent).toContain("--color-primary");
    expect(style?.textContent).toContain(lightTokens["--color-primary"]);
    expect(style?.textContent).toContain(darkTokens["--color-primary"]);
  });

  it("offers navigation to the screens that exist", () => {
    render(<Shell>Walking skeleton.</Shell>);

    const nav = screen.getByRole("navigation");
    expect(within(nav).getByRole("link", { name: /clients/i })).toHaveAttribute("href", "/");
    expect(within(nav).getByRole("link", { name: /new clinic/i })).toHaveAttribute(
      "href",
      "/clients/new",
    );
  });

  it("keeps the Board out of the global nav", () => {
    // A board belongs to ONE clinic, so there is no clinic-less Board URL for a
    // global nav item to point at. It is reached from a clinic's dashboard.
    render(<Shell>Walking skeleton.</Shell>);
    expect(screen.queryByRole("link", { name: /board/i })).not.toBeInTheDocument();
  });

  it("cycles auto → light → dark → auto via [data-theme] on :root", () => {
    render(<Shell>Walking skeleton.</Shell>);

    const toggle = screen.getByRole("button", { name: /color mode/i });
    // No attribute is the AUTO state: prefers-color-scheme decides.
    expect(document.documentElement.getAttribute("data-theme")).toBeNull();

    fireEvent.click(toggle);
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    fireEvent.click(toggle);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    // …and back to auto, which is a real choice rather than the absence of one
    fireEvent.click(toggle);
    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
  });

  it("uses the SAME token classes in light and dark — only values flip", () => {
    render(<Shell>Walking skeleton.</Shell>);
    const banner = screen.getByRole("banner");
    const classesBefore = banner.className;

    fireEvent.click(screen.getByRole("button", { name: /color mode/i }));
    fireEvent.click(screen.getByRole("button", { name: /color mode/i }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    // toggling theme must not restyle via class swaps — the token names are shared
    expect(banner.className).toBe(classesBefore);
  });
});