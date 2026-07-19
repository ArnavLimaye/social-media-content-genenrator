import type { Config } from "tailwindcss";
import { tailwindTheme } from "./lib/theme/tokens";

// The Tailwind theme is derived from lib/theme/tokens.ts — the single source of
// truth. Colors, fonts, and radius all resolve to CSS custom properties, so
// editing the token file restyles the whole app.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: tailwindTheme.colors,
      fontFamily: tailwindTheme.fontFamily,
      borderRadius: tailwindTheme.borderRadius,
      spacing: tailwindTheme.spacing,
      boxShadow: tailwindTheme.boxShadow,
    },
  },
  plugins: [],
};

export default config;