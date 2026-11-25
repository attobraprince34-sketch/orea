import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import { Suspense } from "react";

import { SiteFooter } from "@/components/layout/site-footer";
import { MobileNav } from "@/components/layout/mobile-nav";
import { HeaderFallback, SiteHeader } from "@/components/layout/site-header";
import { Providers } from "@/components/providers/providers";
import "./globals.css";

// Typographies de la charte : Sora (titres, logo) et Inter (textes, interface).
// preload: false : évite l'avertissement Firefox « ressource préchargée mais non
// utilisée » ; display: swap + police de secours ajustée = aucun saut de mise en page.
const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  weight: ["600", "700", "800"],
  display: "swap",
  preload: false,
});
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap", preload: false });

export const metadata: Metadata = {
  title: {
    default: "Orea · Retrouve tes pièces perdues à Abidjan",
    template: "%s · Orea",
  },
  description:
    "CNI, passeport, permis… Orea met en relation ceux qui trouvent une pièce d'identité et ceux qui l'ont perdue, en toute sécurité, via des points relais à Abidjan.",
  applicationName: "Orea",
  appleWebApp: { capable: true, title: "Orea", statusBarStyle: "default" },
  icons: { apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F8F7" },
    { media: "(prefers-color-scheme: dark)", color: "#0B1512" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      // Prévient Next.js que le défilement doux est voulu (désactivé pendant les navigations).
      data-scroll-behavior="smooth"
      className={`${sora.variable} ${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col overflow-x-clip">
        <Providers>
          {/* L'en-tête lit l'URL courante : sur les routes dynamiques, il arrive en
              streaming ; un en-tête statique (logo) s'affiche en attendant. */}
          <Suspense fallback={<HeaderFallback />}>
            <SiteHeader />
          </Suspense>
          <main id="contenu" className="flex flex-1 flex-col">
            {children}
          </main>
          <SiteFooter />
          <Suspense>
            <MobileNav />
          </Suspense>
        </Providers>
      </body>
    </html>
  );
}
