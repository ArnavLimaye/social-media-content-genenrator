import Link from "next/link";
import { ThemeStyle } from "./theme-style";
import { ThemeToggle } from "./theme-toggle";

// The application shell — themed chrome shared by every screen, built to the
// Content Back-Office design.
//
// The header is a CARD SURFACE: `surface-raised` with a bottom `border`. That
// pairing is what separates it from the page; on `surface` alone it dissolves
// into the background in both modes. It spans the full viewport width and
// sticks, so navigation survives scrolling a long Board.
//
// Content width is per-SCREEN, not global. The design gives the dashboard a
// 1020px reading column, the board 1280px (three kanban columns need the room),
// and onboarding 720px (a form column wider than that is hard to scan). A
// single shared max-width — which is what this used to have — makes the board
// cramped and the form absurdly wide at the same time.
const WIDTH = {
  dashboard: "max-w-[1020px]",
  board: "max-w-[1280px]",
  form: "max-w-[720px]",
} as const;

export type ShellWidth = keyof typeof WIDTH;

export function Shell({
  children,
  width = "dashboard",
  nav = "clients",
}: {
  children: React.ReactNode;
  width?: ShellWidth;
  nav?: NavKey;
}) {
  return (
    <div className="min-h-screen bg-surface font-sans text-text">
      <ThemeStyle />
      <Header nav={nav} />
      <main
        className={`mx-auto ${WIDTH[width]} px-5 pb-7 pt-6 font-sans text-text`}
      >
        {children}
      </main>
    </div>
  );
}

type NavKey = "clients" | "new";

const NAV: Array<{ key: NavKey; href: string; label: string }> = [
  { key: "clients", href: "/", label: "Clients" },
  { key: "new", href: "/clients/new", label: "+ New clinic" },
];

function Header({ nav }: { nav: NavKey }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-surface-raised px-5 font-sans text-text">
      {/* The wordmark: product name heavy and primary-colored, its descriptor
          small and muted beside it — one identity, two weights, baseline
          aligned so they read as a single lockup. */}
      <Link
        href="/"
        className="flex items-baseline gap-2 whitespace-nowrap text-primary"
      >
        <span className="text-heading-sm font-extrabold tracking-tight">
          Dental Content
        </span>
        <span className="text-body-xs font-normal text-muted">back-office</span>
      </Link>

      <nav className="flex gap-1">
        {NAV.map((item) => (
          <NavLink key={item.key} href={item.href} active={item.key === nav}>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <span className="flex-1" />
      <ThemeToggle />
    </header>
  );
}

// A nav item is a link, not a button — it navigates to a different resource.
// It borrows the tab LOOK from the design's segmented control but not its
// container, because the header nav is not a mutually-exclusive filter.
function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "whitespace-nowrap rounded-sm bg-primary/10 px-3 py-[5px] text-body-lg font-semibold text-primary"
          : "whitespace-nowrap rounded-sm px-3 py-[5px] text-body-lg font-semibold text-muted hover:text-text"
      }
    >
      {children}
    </Link>
  );
}
