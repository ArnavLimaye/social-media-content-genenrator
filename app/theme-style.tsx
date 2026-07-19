import { tokenCss } from "@/lib/theme/tokens";

// Injects the token CSS custom properties (light, prefers-color-scheme: dark,
// and [data-theme] overrides) from the single source in lib/theme/tokens.ts.
// `:root` matches <html> no matter where the <style> lives, so the vars cascade
// to the whole document.
export function ThemeStyle() {
  return <style dangerouslySetInnerHTML={{ __html: tokenCss() }} />;
}