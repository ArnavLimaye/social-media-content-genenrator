// AGENT-JSON — tolerant JSON extraction + one repair retry (issue #4).
// -----------------------------------------------------------------------------
// The safety net that makes strict-JSON agent output survive real model
// behavior. Two rungs of the reliability ladder live here:
//
// 1. Tolerant extraction — before parsing, slice from the first `{` to the
//    last `}`, then `JSON.parse`. This absorbs ```json fences, prose
//    preambles, and trailing prose.
// 2. One bounded repair retry — if parsing still fails, re-call once with a
//    corrective instruction. Exactly one retry — never a loop.
//
// Unrecoverable input returns a typed failure (never throws) so the generate
// orchestrator can keep a partial batch alive.
//
// The network caller is injected (not imported) so the parse/repair logic is
// exercised with a fake in tests — no network in the suite.

export type CallUsage = {
  promptTokens: number;
  outputTokens: number;
};

export type Caller = (call: AgentCall) => Promise<{
  text: string;
  promptTokens: number;
  outputTokens: number;
}>;

export interface AgentCall {
  model: string;
  system: string;
  user: string;
  maxTokens: number;
  temperature?: number;
}

export type AgentJsonResult<T> =
  | { ok: true; value: T; calls: CallUsage[] }
  | { ok: false; error: string; calls: CallUsage[] };

const REPAIR_INSTRUCTION =
  "Your previous output was not valid JSON. Return ONLY the JSON object, no prose or code fences.";

export async function agentJson<T>(opts: {
  caller: Caller;
  call: AgentCall;
}): Promise<AgentJsonResult<T>> {
  const { caller, call } = opts;
  const calls: CallUsage[] = [];

  const first = await attempt(caller, call, calls);
  if (first.ok) return { ok: true, value: first.value as T, calls };

  // One bounded repair retry: re-call with the corrective instruction
  // appended to the original user message (keep context). Exactly one —
  // never a loop.
  const repairCall: AgentCall = { ...call, user: `${call.user}\n\n${REPAIR_INSTRUCTION}` };
  const repaired = await attempt(caller, repairCall, calls);
  if (repaired.ok) return { ok: true, value: repaired.value as T, calls };

  return { ok: false, error: repaired.error, calls };
}

// One attempt: call the injected caller, record its token usage, and tolerate
// the response through extraction. Mutates `calls` with the per-call usage so
// every underlying call (including the retry) is surfaced for logging.
async function attempt(
  caller: Caller,
  call: AgentCall,
  calls: CallUsage[],
): Promise<{ ok: true; value: unknown } | { ok: false; error: string }> {
  const res = await caller(call);
  calls.push({ promptTokens: res.promptTokens, outputTokens: res.outputTokens });
  return tryParse(res.text);
}

// Tolerant extraction: slice from the first `{` to the last `}`, then parse.
function tryParse(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    return { ok: false, error: "no JSON object found in model output" };
  }
  const slice = text.slice(start, end + 1);
  try {
    return { ok: true, value: JSON.parse(slice) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "failed to parse JSON" };
  }
}