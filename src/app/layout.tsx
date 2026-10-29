import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "SitePilot AI", template: "%s · SitePilot AI" },
  description: "Property feasibility and conveyancing collaboration for NSW investors and licensed professionals.",
  robots: { index: false, follow: false }, // pre-launch
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU">
      <body className="min-h-screen">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
