import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";

// Self-hosted at build time (no runtime request to Google), so the CSP stays font-src 'self'.
const display = Nunito({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  title: { default: "SitePilot AI", template: "%s · SitePilot AI" },
  description: "Discover, analyse and improve property anywhere in Australia, with licensed professionals when it matters.",
  robots: { index: false, follow: false }, // pre-launch
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU" className={display.variable}>
      <body className="min-h-screen">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
