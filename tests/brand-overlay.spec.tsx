import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrandOverlay } from "@/app/brand-overlay";

// Behavior 4/5 (issue #7 — design lock) — the per-Client brand overlay.
//
// A Client's own brand color has to express as the accent everywhere inside
// that Client's screens WITHOUT any component knowing about it. ADR-0003
// predicted this is expressible as a CSS-var override; this pins that.
//
// The test asserts through the rendered DOM (what a browser would actually
// cascade), not through the parsing helper, so the overlay stays free to
// change how it computes the value.

function accentOf(el: Element | null): string {
  return (el as HTMLElement).style.getPropertyValue("--color-accent").trim();
}

describe("per-Client brand overlay", () => {
  it("makes the Client's first brand color the accent for everything inside", () => {
    const { container } = render(
      <BrandOverlay colors="#0aa2c0, #f59e0b">
        <span>Brightside Dental</span>
      </BrandOverlay>,
    );

    // the child renders untouched — the overlay is presentation, not structure
    expect(screen.getByText("Brightside Dental")).toBeInTheDocument();
    // and the accent token is redefined for that subtree
    expect(accentOf(container.firstElementChild)).toBe("#0aa2c0");
  });

  it("leaves the theme's own accent in place when the Client has no colors", () => {
    const { container } = render(
      <BrandOverlay colors={null}>
        <span>No brand yet</span>
      </BrandOverlay>,
    );

    expect(screen.getByText("No brand yet")).toBeInTheDocument();
    // no override — the token falls through to the locked theme value
    expect(accentOf(container.firstElementChild)).toBe("");
  });

  it("ignores a malformed brand color rather than painting an invalid accent", () => {
    // Client.colors is operator-typed free text, so these are all reachable.
    for (const bad of ["", "   ", "teal", "#12", "#gggggg", "0aa2c0", "red;}", "url(x)"]) {
      const { container, unmount } = render(
        <BrandOverlay colors={bad}>
          <span>child</span>
        </BrandOverlay>,
      );
      expect(accentOf(container.firstElementChild), `"${bad}" should not become the accent`).toBe("");
      unmount();
    }
  });

  it("tolerates the whitespace and casing an operator actually types", () => {
    for (const input of ["  #0AA2C0  ,#f59e0b", "#0AA2C0", "#0AA2C0,#f59e0b"]) {
      const { container, unmount } = render(
        <BrandOverlay colors={input}>
          <span>child</span>
        </BrandOverlay>,
      );
      expect(accentOf(container.firstElementChild).toLowerCase()).toBe("#0aa2c0");
      unmount();
    }
  });
});
