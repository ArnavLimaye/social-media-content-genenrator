"use server";

import { generateWeek } from "@/lib/generate-week";
import { callOllama } from "@/lib/ollama";
import { weekStartFor } from "@/lib/schedule-dates";
import type { DraftPost, GenerateResult } from "./dashboard";

// Server action backing the dashboard's "Generate this week" button (issue
// #6). A thin shell over the tested `generateWeek` orchestrator (issue #5): it
// derives the current week's Monday and hands the real Ollama caller to the
// orchestrator, then maps the resulting Posts to the serializable DraftPost
// shape the dashboard renders (Date → ISO string across the server→client
// boundary). The orchestrator's behavior is fully covered by its own tests;
// this is just the wiring — the same relationship saveClient has to
// createClient.

export async function generateThisWeek(clientId: string): Promise<GenerateResult> {
  const weekStart = weekStartFor(new Date());
  const result = await generateWeek({ clientId, weekStart, caller: callOllama });

  if (!result.ok) return result; // { ok: false, error } — identical shape

  const posts: DraftPost[] = result.posts.map((p) => ({
    id: p.id,
    topic: p.topic,
    pillar: p.pillar,
    format: p.format,
    scheduledDate: p.scheduledDate ? p.scheduledDate.toISOString() : "",
  }));

  return { ok: true, plan: result.plan, posts, warnings: result.warnings };
}