import Link from "next/link";
import { Shell } from "./shell";
import { ClientList } from "./client-list";
import { BUTTON_PRIMARY } from "./ui";
import { listClients } from "@/lib/clients";

// The Client list — the operator's landing view: every onboarded clinic, a link
// through to each, and a way to onboard a new one. Submitting the onboarding
// form returns here, where the new clinic now appears.
export default async function Home() {
  const clients = await listClients();

  return (
    <Shell width="dashboard" nav="clients">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-heading font-semibold text-text">Clients</h1>
            <p className="text-body-lg text-muted">
              {clients.length === 0
                ? "No clinics onboarded yet."
                : `${clients.length} clinic${clients.length === 1 ? "" : "s"}`}
            </p>
          </div>
          <Link href="/clients/new" className={BUTTON_PRIMARY}>
            + New clinic
          </Link>
        </div>
        <ClientList clients={clients} />
      </div>
    </Shell>
  );
}
