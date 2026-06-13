import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Smordin Capital — Project Finance News",
  description:
    "Smordin Capital: aggregated project finance and infrastructure news from RSS, GDELT, and optional API sources.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
