import { notFound } from "next/navigation";
import { Shell } from "@/app/shell";
import { prisma } from "@/lib/db";

// Minimal Client detail stub — enough that the Client list's links resolve
// instead of 404ing. The full board (kanban + calendar over the client's
// posts) is a later issue; this just confirms which clinic was opened.
export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) notFound();

  return (
    <Shell>
      <div className="flex flex-col gap-4">
        <h2 className="text-text">{client.name}</h2>
        <dl className="flex flex-col gap-2 text-text">
          <div className="text-text">
            <dt className="text-muted">Monday pillar</dt>
            <dd>{client.pillarMon}</dd>
          </div>
          <div className="text-text">
            <dt className="text-muted">Wednesday pillar</dt>
            <dd>{client.pillarWed}</dd>
          </div>
          <div className="text-text">
            <dt className="text-muted">Friday pillar</dt>
            <dd>{client.pillarFri}</dd>
          </div>
        </dl>
      </div>
    </Shell>
  );
}