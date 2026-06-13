import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "PF News — Project Finance Aggregator",
  description:
    "Aggregated, classified project finance and infrastructure news from RSS, GDELT, and optional API sources.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        {children}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-7NNFFK6ZTG"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-7NNFFK6ZTG');
          `}
        </Script>
      </body>
    </html>
  );
}
