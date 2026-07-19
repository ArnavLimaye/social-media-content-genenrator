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

const BASE = process.env.OLLAMA_BASE_URL ?? "https://ollama.com";
const KEY = process.env.OLLAMA_API_KEY ?? "";

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
  const res = await fetch(`${BASE}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${KEY}`,
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
    throw new Error(`Ollama call failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  const text: string = data.choices?.[0]?.message?.content ?? "";
  // OpenAI-compatible usage block. Field names mirror OpenAI.
  const promptTokens: number = data.usage?.prompt_tokens ?? 0;
  const outputTokens: number = data.usage?.completion_tokens ?? 0;

  return { text, promptTokens, outputTokens };
}
