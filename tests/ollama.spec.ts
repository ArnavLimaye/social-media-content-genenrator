import { describe, it, expect, vi, afterEach } from "vitest";
import { callOllama } from "@/lib/ollama";

// A missing API key must fail with a message that names the cause.
//
// Without this, an unset (or empty) OLLAMA_API_KEY sends `Authorization:
// Bearer ` and the operator sees a bare `401 {"error":"Unauthorized"}` from
// Ollama — which reads as "your key is wrong" and sends you looking at your
// Ollama account instead of at your env files. That is exactly the wrong
// place: the real cause is local config, and `.env.local` silently overriding
// `.env` with an empty value is very easy to do.

const ORIGINAL = process.env.OLLAMA_API_KEY;

afterEach(() => {
  process.env.OLLAMA_API_KEY = ORIGINAL;
  vi.unstubAllGlobals();
});

describe("callOllama: configuration errors", () => {
  it("fails with an actionable message when the API key is missing, without calling the API", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    process.env.OLLAMA_API_KEY = "";

    await expect(
      callOllama({ model: "m", system: "s", user: "u", maxTokens: 10 }),
    ).rejects.toThrow(/OLLAMA_API_KEY/);

    // no point spending a round-trip to be told we are unauthorized
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("points at the model list when a model tag is not found", async () => {
    // Model tags drift on Ollama Cloud, so a 404 here is nearly always "that
    // tag is gone / never existed on this account", not a code defect. The
    // error should say where to look rather than leaving the operator to guess
    // another tag — guessing is what produced the 404 in the first place.
    process.env.OLLAMA_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 404,
        text: async () => '{"error":{"message":"model \\"glm-9.9\\" not found"}}',
      })),
    );

    const err = await callOllama({
      model: "glm-9.9",
      system: "s",
      user: "u",
      maxTokens: 10,
    }).catch((e) => e as Error);

    expect(err.message).toContain("glm-9.9"); // which model failed
    expect(err.message).toMatch(/v1\/models/); // and where to find the real list
  });

  it("treats a whitespace-only key as missing", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    process.env.OLLAMA_API_KEY = "   ";

    await expect(
      callOllama({ model: "m", system: "s", user: "u", maxTokens: 10 }),
    ).rejects.toThrow(/OLLAMA_API_KEY/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
