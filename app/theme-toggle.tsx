"use client";

// Toggles the explicit [data-theme] override on :root. Reads the current theme
// from the DOM (not component state) so it stays correct regardless of what the
// no-FOUC script in layout set before paint. With no [data-theme] set, the
// prefers-color-scheme media query drives the mode.
export function ThemeToggle() {
  function toggle() {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
  }

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={toggle}
      className="rounded border border-muted px-2 py-1 text-text"
    >
      Theme
    </button>
  );
}