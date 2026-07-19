import Link from "next/link";
import type { Client } from "@/generated/prisma/client";

// The Client list — presentational. Given the clients, render each clinic and
// a link through to its detail page. Token-derived classes only (ADR-0003).
export function ClientList({ clients }: { clients: Client[] }) {
  if (clients.length === 0) {
    return (
      <p className="font-sans text-muted">No clients yet. Onboard your first clinic.</p>
    );
  }

  return (
    <ul className="flex flex-col gap-2 font-sans text-text">
      {clients.map((client) => (
        <li key={client.id}>
          <Link
            href={`/clients/${client.id}`}
            className="block rounded border border-muted bg-surface px-4 py-2 text-text"
          >
            {client.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}