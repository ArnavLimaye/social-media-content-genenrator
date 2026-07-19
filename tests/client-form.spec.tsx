import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ClientForm } from "@/app/clients/new/client-form";
import type { ClientInput } from "@/lib/clients";

// Issue #3 — the onboarding form, as a thin shell over lib/clients.ts.
//
// ClientForm is a controlled client component: it holds the field values in
// local state and calls an `onSubmit(values)` async prop. The prop returns
// field-keyed errors (or null on success); the form surfaces them without
// clearing the entered values. The real server action is wired by the page;
// these tests inject a mock so behavior is verified through the public
// interface, independent of persistence.

const noopSubmit = async () => null;

afterEach(() => cleanup());

describe("ClientForm", () => {
  it("renders a field for name, the five optional brand fields, and the three pillars", () => {
    render(<ClientForm onSubmit={noopSubmit} />);

    // required: clinic name + three Mon/Wed/Fri pillars
    expect(screen.getByLabelText(/clinic name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/monday pillar/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/wednesday pillar/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/friday pillar/i)).toBeInTheDocument();

    // optional brand fields (may be left blank)
    expect(screen.getByLabelText(/location/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/audience/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/brand voice/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/brand colors/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/logo url/i)).toBeInTheDocument();

    // brand voice is multi-line free text
    expect(screen.getByLabelText(/brand voice/i).tagName).toBe("TEXTAREA");

    // a submit control is present
    expect(screen.getByRole("button", { name: /save|create|submit/i })).toBeInTheDocument();
  });

  it("submits the entered values through onSubmit", async () => {
    let captured: ClientInput | undefined;
    render(
      <ClientForm
        onSubmit={async (v) => {
          captured = v;
          return null;
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText(/clinic name/i), {
      target: { value: "Lakeside Dental" },
    });
    fireEvent.change(screen.getByLabelText(/monday pillar/i), {
      target: { value: "Patient Education" },
    });
    fireEvent.change(screen.getByLabelText(/wednesday pillar/i), {
      target: { value: "Trust & Clinic Branding" },
    });
    fireEvent.change(screen.getByLabelText(/friday pillar/i), {
      target: { value: "Engagement / Fun" },
    });

    fireEvent.click(screen.getByRole("button", { name: /save|create|submit/i }));

    await screen.findByRole("button", { name: /save|create|submit/i });
    expect(captured).toMatchObject({
      name: "Lakeside Dental",
      pillarMon: "Patient Education",
      pillarWed: "Trust & Clinic Branding",
      pillarFri: "Engagement / Fun",
    });
  });

  it("surfaces validation errors on submit without losing the entered values", async () => {
    // Simulates the server action rejecting: name left blank, Monday pillar
    // left blank, but the operator already typed the Wednesday pillar and
    // brand voice. The form must show the required-field errors AND keep
    // every value the operator entered.
    render(
      <ClientForm
        onSubmit={async () => ({
          name: "Required",
          pillarMon: "Required",
        })}
      />,
    );

    fireEvent.change(screen.getByLabelText(/wednesday pillar/i), {
      target: { value: "Trust & Clinic Branding" },
    });
    fireEvent.change(screen.getByLabelText(/brand voice/i), {
      target: { value: "warm, clear, professional" },
    });

    fireEvent.click(screen.getByRole("button", { name: /save|create|submit/i }));

    // the two required-field errors surface (role=alert per the component)
    const alerts = await screen.findAllByRole("alert");
    expect(alerts.length).toBe(2);

    // entered values are preserved — not cleared by the failed submit
    expect(screen.getByLabelText(/wednesday pillar/i)).toHaveValue(
      "Trust & Clinic Branding",
    );
    expect(screen.getByLabelText(/brand voice/i)).toHaveValue(
      "warm, clear, professional",
    );
  });
});