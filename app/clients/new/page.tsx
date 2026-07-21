"use client";

import { useRouter } from "next/navigation";
import { Shell } from "@/app/shell";
import { ClientForm } from "./client-form";
import { saveClient } from "./actions";

// The onboarding screen. A client component so it can navigate after a
// successful save; everything else is delegated to ClientForm (UI) and the
// saveClient server action (persistence).
//
// The shell's `form` width gives the 720px column the design specifies, so the
// page no longer nests its own narrower container inside a wider one. The
// heading lives in ClientForm alongside the fields it introduces.
export default function NewClientPage() {
  const router = useRouter();

  return (
    <Shell width="form" nav="new">
      <ClientForm
        onSubmit={async (values) => {
          const result = await saveClient(values);
          if (!result.ok) return result.errors;
          router.push("/");
          return null;
        }}
      />
    </Shell>
  );
}
