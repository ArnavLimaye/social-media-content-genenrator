import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dental Content Back-Office",
  description: "Local back office for AI-generated dental clinic social content.",
};

// Set [data-theme] from saved/system preference before paint to avoid a flash.
// With no saved preference, [data-theme] is left unset so prefers-color-scheme
// drives the mode; the ThemeToggle sets it on first interaction.
const noFlashScript = `(function(){try{var t=localStorage.getItem('theme');if(t){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}