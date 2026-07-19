import { ThemeStyle } from "./theme-style";
import { ThemeToggle } from "./theme-toggle";

// The application shell — themed chrome shared by every screen.
// Every color, radius, and font comes from token-derived utility classes
// (bg-surface, text-text, font-sans, rounded-...). No hardcoded values.
export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface font-sans text-text">
      <ThemeStyle />
      <header className="border-b border-muted bg-surface px-4 py-3 font-sans text-text">
        <div className="flex items-center justify-between">
          <h1 className="text-text">Dental Content Back-Office</h1>
          <ThemeToggle />
        </div>
      </header>
      <main className="bg-surface p-4 font-sans text-text">{children}</main>
    </div>
  );
}