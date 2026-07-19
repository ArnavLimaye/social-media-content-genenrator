// Thin wrapper around Ollama Cloud's OpenAI-compatible chat endpoint.
// Each agent passes its own model + maxTokens, and we return the token
// counts so the caller can log them per post.
//
// Set these in .env.local:
//   OLLAMA_BASE_URL=https://ollama.com        (or your endpoint)
//   OLLAMA_API_KEY=sk-...                      (your Ollama Cloud key)
//
// NOTE: confirm current model tags at ollama.com before hardcoding —
// model names/availability change. The ones below are placeholders.

// Read at CALL time, not module load: a module-level const captures whatever
// the environment looked like at import, which makes the value untestable and
// hides late env changes.
function config(): { base: string; key: string } {
  const base = process.env.OLLAMA_BASE_URL?.trim() || "https://ollama.com";
  const key = process.env.OLLAMA_API_KEY?.trim() ?? "";

  // Note `||`, not `??`: an EMPTY key is the failure we actually hit, and `??`
  // only catches undefined. `.env.local` is loaded at higher priority than
  // `.env` by Next, so an empty `OLLAMA_API_KEY=` in `.env.local` silently
  // overrides a real key in `.env` — and the only symptom is a bare 401 from
  // Ollama that looks like a bad account key rather than local config.
  if (!key) {
    throw new Error(
      "OLLAMA_API_KEY is not set. Add it to .env.local (which takes priority " +
        "over .env — an empty value there overrides a real key in .env). " +
        "Restart the dev server after changing env files.",
    );
  }

  return { base, key };
}

export interface OllamaResult {
  text: string;
  promptTokens: number;
  outputTokens: number;
}

export async function callOllama(opts: {
  model: string;
  system: string;
  user: string;
  maxTokens: number;
  temperature?: number;
}): Promise<OllamaResult> {
  const { base, key } = config();

  const res = await fetch(`${base}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens, // per-agent output cap — your token limit lever
      temperature: opts.temperature ?? 0.7,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();

    // A 404 here is almost always a stale model tag rather than a bug: tags
    // come and go on Ollama Cloud, and they differ per account. Say where the
    // authoritative list is, so the next person checks instead of guessing.
    if (res.status === 404) {
      throw new Error(
        `Ollama has no model "${opts.model}" on this account (404). ` +
          `List what is available with: GET ${base}/v1/models. ` +
          `Override the defaults with OLLAMA_PLANNER_MODEL / OLLAMA_COPYWRITER_MODEL. ` +
          `Response: ${body}`,
      );
    }

    throw new Error(`Ollama call failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  const text: string = data.choices?.[0]?.message?.content ?? "";
  // OpenAI-compatible usage block. Field names mirror OpenAI.
  const promptTokens: number = data.usage?.prompt_tokens ?? 0;
  const outputTokens: number = data.usage?.completion_tokens ?? 0;

  return { text, promptTokens, outputTokens };
}
