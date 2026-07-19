// Server-side generate endpoint (issue #5).
// -----------------------------------------------------------------------------
// Thin shell over the tested `generateWeek` orchestrator. The orchestrator is
// fully covered by behavior tests with an injected fake caller; this route is
// just the network wiring — it hands the real Ollama caller (`callOllama`,
// whose return shape matches agent-json's `Caller` type exactly) to the
// orchestrator and returns its result as JSON.

import { NextResponse, type NextRequest } from "next/server";
import { generateWeek } from "@/lib/generate-week";
import { callOllama } from "@/lib/ollama";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: clientId } = await context.params;

  let body: { weekStart?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "request body must be JSON" },
      { status: 400 },
    );
  }

  const weekStartRaw = body.weekStart;
  if (!weekStartRaw) {
    return NextResponse.json(
      { ok: false, error: "weekStart is required (ISO date of the Monday)" },
      { status: 400 },
    );
  }
  const weekStart = new Date(weekStartRaw);
  if (Number.isNaN(weekStart.getTime())) {
    return NextResponse.json(
      { ok: false, error: "weekStart must be a valid ISO date" },
      { status: 400 },
    );
  }

  const result = await generateWeek({ clientId, weekStart, caller: callOllama });

  if (result.ok) return NextResponse.json(result, { status: 200 });
  // distinguish "client not found" from a generation failure
  const status = result.error.includes("client") ? 404 : 500;
  return NextResponse.json(result, { status });
}