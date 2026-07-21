import type { Config } from "tailwindcss";
import { tailwindTheme } from "./lib/theme/tokens";

// The Tailwind theme is derived from lib/theme/tokens.ts — the single source of
// truth. Colors, fonts, and radius all resolve to CSS custom properties, so
// editing the token file restyles the whole app.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Tailwind SUPPORTS a per-color function (it is how the opacity modifier
      // is composed) but its published types only model plain strings, so the
      // cast is asserting something the runtime already guarantees.
      colors: tailwindTheme.colors as unknown as Record<string, string>,
      fontFamily: tailwindTheme.fontFamily,
      fontSize: tailwindTheme.fontSize,
      borderRadius: tailwindTheme.borderRadius,
      spacing: tailwindTheme.spacing,
      boxShadow: tailwindTheme.boxShadow,
    },
  },
  plugins: [],
};

export default config;