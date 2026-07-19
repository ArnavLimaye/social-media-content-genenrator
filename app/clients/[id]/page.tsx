import { notFound } from "next/navigation";
import { Shell } from "@/app/shell";
import { prisma } from "@/lib/db";
import { generationBlocker } from "@/lib/clients";
import { ClientDashboard } from "./dashboard";
import { generateThisWeek } from "./actions";

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

  return (
    <Shell>
      <ClientDashboard
        client={{
          id: client.id,
          name: client.name,
          logoUrl: client.logoUrl,
          colors: client.colors,
        }}
        blockedReason={blockedReason}
        onGenerate={generateThisWeek}
      />
    </Shell>
  );
}