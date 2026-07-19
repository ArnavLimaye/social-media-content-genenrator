import { describe, it, expect } from "vitest";
import { agentJson } from "@/lib/agent-json";

// Issue #4 — agent-json: tolerant JSON extraction + one repair retry.
//
// `lib/agent-json.ts` is the safety net that makes strict-JSON agent output
// survive real model behavior. It is a deep, pure module with an injected
// caller: the parse/repair logic is exercised here through the public
// interface using a fake caller — no network access anywhere in the suite.
//
// The tests describe behavior ("parses fenced JSON", "retries once"), not
// implementation, so they survive any internal refactor.

// A fake caller that returns a scripted sequence of responses. Each call
// records its AgentCall (so tests can assert call count and the corrective
// prompt) and pops the next scripted response. No fetch, no network.
function fakeCaller(responses: Array<{ text: string; promptTokens: number; outputTokens: number }>) {
  const calls: import("@/lib/agent-json").AgentCall[] = [];
  const caller = async (call: import("@/lib/agent-json").AgentCall) => {
    calls.push(call);
    const next = responses[calls.length - 1];
    if (!next) throw new Error("fakeCaller ran out of scripted responses");
    return next;
  };
  return { caller, calls };
}

describe("agent-json: tolerant extraction + one repair retry", () => {
  it("parses clean JSON unchanged and surfaces the single call's token counts", async () => {
    const { caller, calls } = fakeCaller([
      { text: `{"day":"Monday","topic":"bleeding gums"}`, promptTokens: 100, outputTokens: 20 },
    ]);

    const result = await agentJson<{ day: string; topic: string }>({
      caller,
      call: { model: "qwen", system: "sys", user: "make a plan", maxTokens: 800 },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({ day: "Monday", topic: "bleeding gums" });

    // exactly one underlying call — clean JSON needs no retry
    expect(calls).toHaveLength(1);
    expect(result.calls).toEqual([{ promptTokens: 100, outputTokens: 20 }]);
  });

  it("parses JSON wrapped in ```json fences", async () => {
    const { caller, calls } = fakeCaller([
      { text: "```json\n{\"day\":\"Monday\",\"topic\":\"bleeding gums\"}\n```", promptTokens: 100, outputTokens: 20 },
    ]);

    const result = await agentJson<{ day: string }>({
      caller,
      call: { model: "qwen", system: "sys", user: "make a plan", maxTokens: 800 },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({ day: "Monday", topic: "bleeding gums" });
    expect(calls).toHaveLength(1); // tolerated on the first call — no retry
  });

  it("parses JSON preceded by prose preamble and followed by trailing prose", async () => {
    const text =
      "Here's your content for the week:\n\n" +
      '{"day":"Friday","topic":"flossing myths"}\n\n' +
      "Hope that helps! Let me know if you need more.";
    const { caller, calls } = fakeCaller([{ text, promptTokens: 100, outputTokens: 20 }]);

    const result = await agentJson<{ day: string }>({
      caller,
      call: { model: "qwen", system: "sys", user: "make a plan", maxTokens: 800 },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({ day: "Friday", topic: "flossing myths" });
    expect(calls).toHaveLength(1); // tolerated on the first call — no retry
  });

  it("issues exactly one repair retry when the first output is unparseable", async () => {
    const { caller, calls } = fakeCaller([
      { text: "Sure, here's the plan: (not valid json at all)", promptTokens: 100, outputTokens: 5 },
      { text: `{"day":"Monday","topic":"x"}`, promptTokens: 110, outputTokens: 20 },
    ]);

    const result = await agentJson<{ day: string }>({
      caller,
      call: { model: "qwen", system: "sys", user: "make a plan", maxTokens: 800 },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({ day: "Monday", topic: "x" });

    // exactly two underlying calls — the original + exactly one retry, never more
    expect(calls).toHaveLength(2);
    // the retry carries the corrective instruction, with the original ask kept
    expect(calls[1].user).toContain("not valid JSON");
    expect(calls[1].user).toContain("make a plan");
  });

  it("returns a typed failure (never throws) when both attempts are unparseable", async () => {
    const { caller, calls } = fakeCaller([
      { text: "I cannot do that.", promptTokens: 100, outputTokens: 5 },
      { text: "still not json here", promptTokens: 110, outputTokens: 5 },
    ]);

    const result = await agentJson<{ day: string }>({
      caller,
      call: { model: "qwen", system: "sys", user: "make a plan", maxTokens: 800 },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(typeof result.error).toBe("string");
    expect(result.error.length).toBeGreaterThan(0);

    // both underlying calls still surfaced for logging
    expect(calls).toHaveLength(2);
    expect(result.calls).toHaveLength(2);
  });

  it("surfaces distinct token counts from every underlying call, including the retry", async () => {
    const { caller, calls } = fakeCaller([
      { text: "not json", promptTokens: 100, outputTokens: 5 },
      { text: `{"ok":true}`, promptTokens: 250, outputTokens: 40 },
    ]);

    const result = await agentJson<{ ok: boolean }>({
      caller,
      call: { model: "qwen", system: "sys", user: "make a plan", maxTokens: 800 },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // the original call's tokens AND the retry's tokens are both present,
    // each carrying its own distinct values (the repair cost extra input
    // tokens — the corrected prompt is longer — and produced output).
    expect(result.calls).toEqual([
      { promptTokens: 100, outputTokens: 5 },
      { promptTokens: 250, outputTokens: 40 },
    ]);
    // parity: one CallUsage per underlying caller invocation
    expect(result.calls).toHaveLength(calls.length);
  });
});