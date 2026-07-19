import Link from "next/link";
import type { Client } from "@/generated/prisma/client";
import { BrandOverlay } from "@/app/brand-overlay";
import { ClinicTile } from "@/app/ui";

// The Client list — presentational. Given the clients, render each clinic and
// a link through to its detail page. Token-derived classes only (ADR-0003).
export function ClientList({ clients }: { clients: Client[] }) {
  if (clients.length === 0) {
    return (
      // A dashed border reads as a placeholder rather than as content that
      // failed to load — the list is empty by design on first run.
      <p className="rounded border border-dashed border-border p-6 text-center font-sans text-muted">
        No clients yet. Onboard your first clinic.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2 font-sans text-text">
      {clients.map((client) => (
        <li key={client.id}>
          <Link
            href={`/clients/${client.id}`}
            className="flex items-center gap-3 rounded border border-border bg-surface-raised px-4 py-3 text-text shadow-sm hover:border-accent"
          >
            {/* Each row is wrapped in its own overlay, so the tile shows that
                clinic's brand rather than the theme accent (#7). */}
            <BrandOverlay colors={client.colors}>
              <ClinicTile name={client.name} logoUrl={client.logoUrl} size="sm" />
            </BrandOverlay>
            <span className="font-semibold">{client.name}</span>
            {client.location ? (
              <span className="text-sm text-muted">{client.location}</span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}