import Link from "next/link";
import type { Client } from "@/generated/prisma/client";
import { BrandOverlay } from "@/app/brand-overlay";
import { ClinicTile, PillarChip } from "@/app/ui";

// The Client list — presentational. Given the clients, render each clinic and a
// link through to its detail page.
//
// A row carries the clinic's three pillars alongside its name, because the
// pillars are what distinguish two clinics in the same town — and they are the
// thing an operator is checking when they come here to pick one.
export function ClientList({ clients }: { clients: Client[] }) {
  if (clients.length === 0) {
    return (
      // A dashed border reads as a placeholder rather than as content that
      // failed to load — the list is empty by design on first run.
      <p className="rounded border border-dashed border-border p-6 text-center font-sans text-body-lg text-muted">
        No clients yet. Onboard your first clinic.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2 font-sans text-text">
      {clients.map((client) => (
        <li key={client.id}>
          {/* Each row is wrapped in its own overlay, so the tile and pillar
              chips show that clinic's brand rather than the theme accent. */}
          <BrandOverlay colors={client.colors}>
            <Link
              href={`/clients/${client.id}`}
              className="flex items-center gap-3 rounded border border-border bg-surface-raised px-4 py-3 text-text shadow-sm hover:border-accent"
            >
              <ClinicTile name={client.name} logoUrl={client.logoUrl} size="sm" />
              <span className="min-w-0">
                <span className="block truncate text-control font-semibold text-text">
                  {client.name}
                </span>
                {client.location ? (
                  <span className="block truncate text-body text-muted">
                    {client.location}
                  </span>
                ) : null}
              </span>
              <span className="flex-1" />
              <span className="hidden flex-wrap justify-end gap-1 sm:flex">
                {[client.pillarMon, client.pillarWed, client.pillarFri].map((p, i) => (
                  <PillarChip key={i}>{p}</PillarChip>
                ))}
              </span>
            </Link>
          </BrandOverlay>
        </li>
      ))}
    </ul>
  );
}
