import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { PostCard, type PostCardProps } from "@/app/clients/[id]/board/post-card";
import type { SerializedPost } from "@/lib/posts";

// Issue #8 — the Post card, the reusable centrepiece of the Board (and later
// #9's week-list / drawer). Built to the #7 design lock (docs/design/post-card.md):
// badge row (format + pillar + status), topic + hook, review flags, slides,
// caption, CTA, hashtags, footer. Inline-editable copy fields commit on blur
// through injected callbacks — the page wires real server actions, these tests
// inject fakes so behavior is verified through the public interface, independent
// of the database. Token-derived classes only (ADR-0003).

function fakePost(overrides: Partial<SerializedPost> = {}): SerializedPost {
  return {
    id: "p1",
    clientId: "c1",
    planId: "pl1",
    pillar: "Patient Education",
    format: "carousel",
    topic: "Why bleeding gums are not normal — 3 causes",
    objective: "Teach patients to recognise gingivitis early",
    hook: "Bleeding gums are not a flex. Here's what they're telling you.",
    caption: "Most people brush past bleeding gums. Don't.",
    cta: "Book a checkup at the link in bio.",
    slides: [
      {
        heading: "Bleeding gums? Read this",
        description: "3 causes you can spot at home",
        imagePrompt:
          'Healthy gums beside inflamed ones, so the difference is obvious. Text reads exactly: "BLEEDING GUMS AREN\'T NORMAL". Square 1:1.',
        imageIdeas: [
          { type: "photo", idea: "close-up of healthy vs inflamed gumline" },
          { type: "creative", idea: "icon trio: floss, brush, rinse" },
        ],
      },
      // Deliberately has no `imagePrompt` — the pre-imagePrompt slide shape,
      // which stored Posts still carry and the card must still render.
      {
        heading: "Cause 1",
        description: "Plaque buildup along the gumline",
        imageIdeas: [{ type: "creative", idea: "diagram of plaque layer" }],
      },
    ],
    hashtags: ["#dentalcare", "#gumhealth", "#austindentist"],
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

const noopProps: Pick<PostCardProps, "onEditField" | "onEditHashtags" | "onEditSlide"> = {
  onEditField: vi.fn(),
  onEditHashtags: vi.fn(),
  onEditSlide: vi.fn(),
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PostCard: read mode renders the locked card", () => {
  it("shows the format badge with glyph + label, pillar badge, topic, hook, caption, CTA, and hashtags", () => {
    render(<PostCard post={fakePost()} {...noopProps} />);

    // format badge: glyph + label (carousel → ▤)
    expect(screen.getByText(/carousel/i)).toBeInTheDocument();

    // pillar badge carries the brand — the element that visibly rebrands per
    // Client (design-lock §4). It reads the pillar name.
    expect(screen.getByText("Patient Education")).toBeInTheDocument();

    // topic is a heading (not editable)
    expect(
      screen.getByText("Why bleeding gums are not normal — 3 causes"),
    ).toBeInTheDocument();

    // hook / caption / CTA render as inline-edit inputs occupying the same box
    // as the text would (design-lock §2) — read them by label + displayed value.
    expect(screen.getByLabelText(/^Hook —/)).toHaveDisplayValue(
      "Bleeding gums are not a flex. Here's what they're telling you.",
    );
    expect(screen.getByLabelText(/^Caption —/)).toHaveDisplayValue(
      "Most people brush past bleeding gums. Don't.",
    );
    expect(screen.getByLabelText(/^CTA —/)).toHaveDisplayValue(
      "Book a checkup at the link in bio.",
    );

    // hashtags render as one joined input (split back to an array on commit)
    expect(screen.getByLabelText(/^Hashtags —/)).toHaveDisplayValue(
      "#dentalcare #gumhealth #austindentist",
    );
  });

  it("uses the format glyph for each format", () => {
    const { rerender } = render(<PostCard post={fakePost({ format: "carousel" })} {...noopProps} />);
    expect(screen.getByText(/▤/)).toBeInTheDocument();

    rerender(<PostCard post={fakePost({ format: "reel" })} {...noopProps} />);
    expect(screen.getByText(/▶/)).toBeInTheDocument();

    rerender(<PostCard post={fakePost({ format: "infographic" })} {...noopProps} />);
    expect(screen.getByText(/◫/)).toBeInTheDocument();
  });

  it("renders the status badge from the post status", () => {
    render(<PostCard post={fakePost({ status: "approved" })} {...noopProps} />);
    expect(screen.getByText(/approved/i)).toBeInTheDocument();
  });

  it("renders each slide's heading, description, and image-idea chips tagged by type", () => {
    render(<PostCard post={fakePost()} {...noopProps} />);

    // slide 1
    expect(screen.getByLabelText(/^Slide\ 1\ heading —/)).toHaveDisplayValue(
      "Bleeding gums? Read this",
    );
    expect(screen.getByLabelText(/^Slide\ 1\ description —/)).toHaveDisplayValue(
      "3 causes you can spot at home",
    );
    // slide 2
    expect(screen.getByLabelText(/^Slide\ 2\ heading —/)).toHaveDisplayValue("Cause 1");
    expect(screen.getByLabelText(/^Slide\ 2\ description —/)).toHaveDisplayValue(
      "Plaque buildup along the gumline",
    );

    // image-idea chips repeat the kind as uppercase text (design-lock §2 — the
    // distinction is never color-only). CSS uppercases it visually; the DOM
    // text is the lowercase type. One photo + two creative in the fixture.
    const chips = screen.getAllByText(/^(photo|creative)$/i);
    expect(chips).toHaveLength(3);
    expect(chips.map((c) => c.textContent)).toEqual(
      expect.arrayContaining(["photo", "creative", "creative"]),
    );
  });

  // The brief is the deliverable — it is a paste-ready image-tool prompt, so a
  // card that shows only the type chip gives the operator nothing to act on.
  it("renders each image idea's brief text, with a copy button per idea", () => {
    render(<PostCard post={fakePost()} {...noopProps} />);

    expect(screen.getByText("close-up of healthy vs inflamed gumline")).toBeInTheDocument();
    expect(screen.getByText("icon trio: floss, brush, rinse")).toBeInTheDocument();
    expect(screen.getByText("diagram of plaque layer")).toBeInTheDocument();

    expect(
      screen.getByLabelText("Copy image idea: diagram of plaque layer"),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Copy image idea:/ })).toHaveLength(3);
  });

  // The asset prompt is the slide's actual deliverable — the string pasted
  // into an external image/video tool — so it renders editable and copyable.
  it("renders the slide's asset prompt, editable and copyable", () => {
    const onEditSlide = vi.fn();
    render(<PostCard post={fakePost()} {...noopProps} onEditSlide={onEditSlide} />);

    const field = screen.getByLabelText(/^Slide 1 asset prompt —/);
    expect(field).toHaveDisplayValue(
      'Healthy gums beside inflamed ones, so the difference is obvious. Text reads exactly: "BLEEDING GUMS AREN\'T NORMAL". Square 1:1.',
    );
    expect(
      screen.getByRole("button", { name: /^Copy Slide 1 asset prompt —/ }),
    ).toBeInTheDocument();

    fireEvent.change(field, { target: { value: "a reworked prompt" } });
    fireEvent.blur(field);
    expect(onEditSlide).toHaveBeenCalledWith("p1", 0, "imagePrompt", "a reworked prompt");
  });

  // Posts generated before `imagePrompt` existed have slides without it. Those
  // slides must say so, not render a silent gap that reads as "needs no asset".
  it("names the gap on a slide that predates asset prompts", () => {
    render(<PostCard post={fakePost()} {...noopProps} />);

    expect(screen.queryByLabelText(/^Slide 2 asset prompt —/)).not.toBeInTheDocument();
    expect(screen.getByText(/No asset prompt — regenerate this post/)).toBeInTheDocument();
  });
});

describe("PostCard: review flags", () => {
  it("a flagged post shows a flag badge with the count, expanding to one claim → reason line per flag", () => {
    const post = fakePost({
      reviewFlags: [
        {
          claim: "Whitening is completely safe for everyone",
          reason: "absolute safety claim, needs clinician review",
        },
        {
          claim: "Flossing daily reverses gingivitis",
          reason: "outcome-adjacent claim",
        },
      ],
    });
    render(<PostCard post={post} {...noopProps} />);

    // collapsed: the badge names the count
    const badge = screen.getByRole("button", { name: /2 flags/i });
    expect(badge).toHaveAttribute("aria-expanded", "false");

    // nothing expanded yet
    expect(screen.queryByText(/whitening is completely safe/i)).not.toBeInTheDocument();

    // expand
    fireEvent.click(badge);
    expect(badge).toHaveAttribute("aria-expanded", "true");

    // each flag's claim (quoted) and reason are shown, joined by an arrow
    expect(screen.getByText(/whitening is completely safe for everyone/i)).toBeInTheDocument();
    expect(screen.getByText(/absolute safety claim, needs clinician review/i)).toBeInTheDocument();
    expect(screen.getByText(/flossing daily reverses gingivitis/i)).toBeInTheDocument();
    expect(screen.getByText(/outcome-adjacent claim/i)).toBeInTheDocument();
  });

  it("a post with no review flags shows no flag badge", () => {
    render(<PostCard post={fakePost({ reviewFlags: null })} {...noopProps} />);
    expect(screen.queryByRole("button", { name: /flags/i })).not.toBeInTheDocument();
  });
});

describe("PostCard: long copy is not visually truncated", () => {
  // Captions and slide descriptions routinely run to several paragraphs. In a
  // single-line <input> the operator can only ever see one line of it, so the
  // card silently hides most of the copy it exists to show (design-lock §2,
  // amended on #8). These fields must be textareas that grow to fit.
  const longCaption =
    "Enamel is tough — but it's not invincible.\n\n" +
    "Brushing too hard, sipping something acidic all afternoon, or using your " +
    "teeth to open a packet all wear it down.\n\n" +
    "Small adjustments make a real difference.";

  it("renders caption and slide descriptions as textareas, not single-line inputs", () => {
    render(<PostCard post={fakePost({ caption: longCaption })} {...noopProps} />);

    expect(screen.getByLabelText(/^Caption —/).tagName).toBe("TEXTAREA");
    expect(screen.getByLabelText(/^Slide 1 description —/).tagName).toBe("TEXTAREA");
    // The hook is one sentence but a LONG one, and it is the field operators
    // rewrite most — it wraps to two lines far more often than not.
    expect(screen.getByLabelText(/^Hook —/).tagName).toBe("TEXTAREA");
  });

  it("keeps genuinely single-line fields as inputs", () => {
    render(<PostCard post={fakePost()} {...noopProps} />);

    expect(screen.getByLabelText(/^CTA —/).tagName).toBe("INPUT");
    expect(screen.getByLabelText(/^Hashtags —/).tagName).toBe("INPUT");
    expect(screen.getByLabelText(/^Slide 1 heading —/).tagName).toBe("INPUT");
  });

  it("sizes the caption textarea to its content — longer copy gets more rows", () => {
    // happy-dom does not lay text out, so scrollHeight-based auto-sizing cannot
    // be observed here. The `rows` attribute is the part that is real in the
    // DOM: it must scale with the content rather than being pinned to 1.
    // rendered independently, not via rerender: each card seeds its editable
    // state from props on mount, so a rerender would keep the first caption.
    const { unmount } = render(
      <PostCard post={fakePost({ caption: "Short." })} {...noopProps} />,
    );
    const short = Number(screen.getByLabelText(/^Caption —/).getAttribute("rows"));
    unmount();

    render(<PostCard post={fakePost({ caption: longCaption })} {...noopProps} />);
    const long = Number(screen.getByLabelText(/^Caption —/).getAttribute("rows"));

    expect(short).toBeGreaterThanOrEqual(1);
    expect(long).toBeGreaterThan(short);
  });

  it("still commits a caption edit on blur", () => {
    // the control changed from input to textarea — the edit contract must not
    const onEditField = vi.fn();
    render(
      <PostCard post={fakePost()} onEditField={onEditField} onEditHashtags={vi.fn()} onEditSlide={vi.fn()} />,
    );

    const caption = screen.getByLabelText(/^Caption —/);
    fireEvent.change(caption, { target: { value: longCaption } });
    fireEvent.blur(caption);

    expect(onEditField).toHaveBeenCalledWith("p1", "caption", longCaption);
  });
});

describe("PostCard: inline editing commits on blur through the injected callbacks", () => {
  it("edits hook → onEditField(postId, 'hook', value)", () => {
    const onEditField = vi.fn();
    render(<PostCard post={fakePost()} onEditField={onEditField} onEditHashtags={vi.fn()} onEditSlide={vi.fn()} />);

    const hook = screen.getByLabelText(/^Hook —/);
    fireEvent.change(hook, { target: { value: "Spit pink? That's a signal." } });
    fireEvent.blur(hook);

    expect(onEditField).toHaveBeenCalledWith("p1", "hook", "Spit pink? That's a signal.");
    // the field reflects the edited value
    expect(hook).toHaveDisplayValue("Spit pink? That's a signal.");
  });

  it("edits caption and CTA via onEditField", () => {
    const onEditField = vi.fn();
    render(<PostCard post={fakePost()} onEditField={onEditField} onEditHashtags={vi.fn()} onEditSlide={vi.fn()} />);

    const caption = screen.getByLabelText(/^Caption —/);
    fireEvent.change(caption, { target: { value: "New caption text." } });
    fireEvent.blur(caption);
    expect(onEditField).toHaveBeenCalledWith("p1", "caption", "New caption text.");

    const cta = screen.getByLabelText(/^CTA —/);
    fireEvent.change(cta, { target: { value: "DM us to book." } });
    fireEvent.blur(cta);
    expect(onEditField).toHaveBeenCalledWith("p1", "cta", "DM us to book.");
  });

  it("edits hashtags → onEditHashtags with the whitespace-split array", () => {
    const onEditHashtags = vi.fn();
    render(<PostCard post={fakePost()} onEditField={vi.fn()} onEditHashtags={onEditHashtags} onEditSlide={vi.fn()} />);

    const tags = screen.getByLabelText(/^Hashtags —/);
    fireEvent.change(tags, { target: { value: "#gumhealth #austindentist   #booknow" } });
    fireEvent.blur(tags);

    // split on whitespace, blanks dropped
    expect(onEditHashtags).toHaveBeenCalledWith("p1", [
      "#gumhealth",
      "#austindentist",
      "#booknow",
    ]);
  });

  it("edits a slide heading → onEditSlide(postId, index, 'heading', value)", () => {
    const onEditSlide = vi.fn();
    render(<PostCard post={fakePost()} onEditField={vi.fn()} onEditHashtags={vi.fn()} onEditSlide={onEditSlide} />);

    const heading = screen.getByLabelText(/^Slide\ 2\ heading —/);
    fireEvent.change(heading, { target: { value: "Cause 1: plaque" } });
    fireEvent.blur(heading);

    expect(onEditSlide).toHaveBeenCalledWith("p1", 1, "heading", "Cause 1: plaque");
  });

  it("edits a slide description → onEditSlide(postId, index, 'description', value)", () => {
    const onEditSlide = vi.fn();
    render(<PostCard post={fakePost()} onEditField={vi.fn()} onEditHashtags={vi.fn()} onEditSlide={onEditSlide} />);

    const desc = screen.getByLabelText(/^Slide\ 1\ description —/);
    fireEvent.change(desc, { target: { value: "Spot these at home." } });
    fireEvent.blur(desc);

    expect(onEditSlide).toHaveBeenCalledWith("p1", 0, "description", "Spot these at home.");
  });

  it("does not commit an unchanged field (no spurious writes on blur)", () => {
    const onEditField = vi.fn();
    render(<PostCard post={fakePost()} onEditField={onEditField} onEditHashtags={vi.fn()} onEditSlide={vi.fn()} />);

    // focus + blur without changing the value → no write
    const hook = screen.getByLabelText(/^Hook —/);
    hook.focus();
    fireEvent.blur(hook);
    expect(onEditField).not.toHaveBeenCalled();
  });
});