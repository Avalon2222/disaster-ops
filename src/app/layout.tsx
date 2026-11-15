import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { URL_SITUS } from "@/lib/situs";
import "./globals.css";

// font di-host sendiri lewat next/font: tanpa request ke Google saat runtime, tanpa lompatan tata letak
const fontMono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap", variable: "--font-jetbrains" });

const SLOGAN = "When the ground shakes and the sky burns, this is the room that stays awake.";

export const metadata: Metadata = {
  metadataBase: new URL(URL_SITUS),
  title: "Disaster Ops — war room bencana Indonesia",
  description: `${SLOGAN} War room bencana Indonesia: karhutla live, gempa BMKG + USGS, simulasi tsunami, gunung api, banjir, angin, dan prakiraan risiko 7 hari. Semua dari data publik.`,
  keywords: ["Indonesia", "bencana", "disaster", "karhutla", "hotspot", "FIRMS", "gempa", "BMKG", "tsunami", "gunung api", "banjir", "MapLibre", "war room"],
  authors: [{ name: "Avalon2222", url: "https://github.com/Avalon2222" }],
  openGraph: {
    title: "Disaster Ops",
    description: SLOGAN,
    url: URL_SITUS,
    siteName: "Disaster Ops",
    type: "website",
    locale: "id_ID",
  },
  twitter: { card: "summary_large_image", title: "Disaster Ops", description: SLOGAN },
};

export const viewport: Viewport = {
  themeColor: "#05080f",
  width: "device-width",
  initialScale: 1,
  // sengaja tanpa maximumScale: halaman boleh di-pinch-zoom (aksesibilitas); peta tetap menangani pinch-nya sendiri
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`h-full ${fontMono.variable}`}>
      <head>
        <link rel="preconnect" href="https://tiles.openfreemap.org" />
      </head>
      <body className="h-full">
        {children}
        {/* Vercel Web Analytics: tanpa cookie, skripnya dari domain sendiri (/_vercel/insights).
            Cuma dipasang di build Vercel; di lokal/CI jalur itu tidak ada. */}
        {process.env.VERCEL ? <Analytics /> : null}
      </body>
    </html>
  );
}
