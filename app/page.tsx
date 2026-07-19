import Link from "next/link";
import { Shell } from "./shell";
import { ClientList } from "./client-list";
import { listClients } from "@/lib/clients";

// Screen 1 — the Client list. The operator's landing view: every onboarded
// clinic, a link through to each, and a way to onboard a new one. Submitting
// the onboarding form returns here, where the new clinic now appears.
export default async function Home() {
  const clients = await listClients();

  return (
    <Shell>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight text-text">Clients</h1>
          <Link
            href="/clients/new"
            className="rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-on-primary"
          >
            New client
          </Link>
        </div>
        <ClientList clients={clients} />
      </div>
    </Shell>
  );
}