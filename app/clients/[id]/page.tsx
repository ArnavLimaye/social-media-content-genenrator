import { notFound } from "next/navigation";
import { Shell } from "@/app/shell";
import { prisma } from "@/lib/db";
import { generationBlocker } from "@/lib/clients";
import { weekPlanSummary } from "@/lib/generate-week";
import { weekStartFor } from "@/lib/schedule-dates";
import { BrandOverlay } from "@/app/brand-overlay";
import { ClientDashboard } from "./dashboard";
import { generateThisWeek, regenerateThisWeek } from "./actions";

// Screen 2 (issue #6) — the Client dashboard. A server component that loads
// the clinic, computes the generation prerequisite blocker, and renders the
// ClientDashboard client component with the real generateThisWeek server
// action wired as `onGenerate`. The dashboard owns the generation states
// (pending, success, partial success, failure, blocked); this page is just the
// shell that connects a Client to its action. Token-derived classes only
// (ADR-0003).
export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) notFound();

  const blockedReason = generationBlocker(client);
  // Whether this week is already planned decides which action the dashboard
  // offers, and how many drafts its confirmation has to account for (#11).
  const weekPlan = await weekPlanSummary(client.id, weekStartFor(new Date()));

  return (
    <Shell>
      <BrandOverlay colors={client.colors}>
        <ClientDashboard
          client={{
            id: client.id,
            name: client.name,
            logoUrl: client.logoUrl,
            colors: client.colors,
          }}
          blockedReason={blockedReason}
          weekPlan={weekPlan}
          onGenerate={generateThisWeek}
          onRegenerate={regenerateThisWeek}
        />
      </BrandOverlay>
    </Shell>
  );
}