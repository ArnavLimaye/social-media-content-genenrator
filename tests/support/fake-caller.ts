import type { AgentCall, Caller } from "@/lib/agent-json";

// The generation suite's stand-in for Ollama. `generateWeek` and
// `regenerateWeek` take their model caller as an argument (agent-json's
// `Caller`), so every generation test drives real code against the real test.db
// with no network — the injection seam exists precisely for this.
//
// Responses are popped in call order, and each AgentCall is recorded so a test
// can assert what the agents were actually told (the avoid-list, the days being
// planned). Running out of scripted responses throws rather than hanging or
// returning junk: a test that triggers more model calls than it scripted has
// found a real behavior change, and should say so loudly.

export type Scripted = { text: string; promptTokens: number; outputTokens: number };

export function fakeCaller(responses: Scripted[]) {
  const calls: AgentCall[] = [];
  const queue = [...responses];
  const caller: Caller = async (call) => {
    calls.push(call);
    const next = queue.shift();
    if (!next) throw new Error("fakeCaller ran out of scripted responses");
    return next;
  };
  return { caller, calls };
}
