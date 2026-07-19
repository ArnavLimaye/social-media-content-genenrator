// The clinic's initials, for the identity tile when a Client has no logoUrl —
// which is the common case, not the edge case (the onboarding form makes the
// logo optional). Takes the first letter of up to two words, so "Little Smiles
// Pediatric" reads "LS" rather than an unbalanced "LSP".
//
// Deliberately its own module rather than living in lib/clients.ts: this is
// consumed by a CLIENT component, and lib/clients.ts imports Prisma at the top
// level. Importing it from the client bundle drags better-sqlite3 in and fails
// the build.
export function clinicInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}
