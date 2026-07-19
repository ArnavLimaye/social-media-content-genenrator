"use client";

import { useRouter } from "next/navigation";
import { Shell } from "@/app/shell";
import { ClientForm } from "./client-form";
import { saveClient } from "./actions";

// The onboarding screen. A client component so it can navigate after a
// successful save; everything else is delegated to ClientForm (UI) and the
// saveClient server action (persistence). Token-derived classes only.
export default function NewClientPage() {
  const router = useRouter();

  return (
    <Shell>
      <div className="flex flex-col gap-4">
        <h2 className="text-text">Onboard a clinic</h2>
        <ClientForm
          onSubmit={async (values) => {
            const result = await saveClient(values);
            if (!result.ok) return result.errors;
            router.push("/");
            return null;
          }}
        />
      </div>
    </Shell>
  );
}