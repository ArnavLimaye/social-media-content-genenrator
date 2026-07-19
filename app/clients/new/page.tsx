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
      {/* Narrower than the shell's container: a single-column form reads badly
          at full width, which is what it did before #14. */}
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text">Onboard a clinic</h1>
          <p className="text-sm text-muted">
            Everything the planner and copywriter need to write in this clinic&apos;s voice.
          </p>
        </div>
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