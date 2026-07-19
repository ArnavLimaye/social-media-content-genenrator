import Link from "next/link";
import { ThemeStyle } from "./theme-style";
import { ThemeToggle } from "./theme-toggle";

// The application shell — themed chrome shared by every screen (#14, applying
// the #7 design lock).
//
// The header is a CARD SURFACE: `surface-raised` with a bottom `border`. That
// pairing is what separates it from the page; on `surface` alone it dissolves
// into the background in both modes. It sticks, so navigation survives
// scrolling a long Board (#8).
//
// Every color, radius, and font comes from token-derived utility classes. No
// hardcoded values (ADR-0003).
export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface font-sans text-text">
      <ThemeStyle />
      <header className="sticky top-0 z-30 border-b border-border bg-surface-raised px-5 font-sans text-text">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6">
          {/* Kept as the product's actual name — the prototype's "enamel"
              wordmark is a naming decision for the operator, not for us. */}
          <Link href="/" className="whitespace-nowrap font-semibold tracking-tight text-primary">
            Dental Content Back-Office
          </Link>

          {/* No Board link until #8 ships those screens — it would 404. */}
          <nav className="flex items-center gap-1">
            <NavLink href="/">Clients</NavLink>
            <NavLink href="/clients/new">+ New clinic</NavLink>
          </nav>

          <span className="flex-1" />
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-6xl bg-surface px-5 py-6 font-sans text-text">
        {children}
      </main>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-sm px-3 py-1 text-sm font-semibold text-muted hover:bg-surface hover:text-text"
    >
      {children}
    </Link>
  );
}
