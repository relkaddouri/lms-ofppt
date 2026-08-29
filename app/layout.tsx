import type { Metadata } from "next";
import { IBM_Plex_Mono, Sora, Source_Sans_3 } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";

/**
 * Trois polices, trois rôles distincts (design_system.md §2) :
 * Sora pour les titres, Source Sans 3 pour l'interface, IBM Plex Mono pour
 * toute donnée précise — code de module, taux, date courte, effectif.
 *
 * Les graisses reprises ici sont celles réellement appelées par la planche de
 * style : Sora 400/600/700, Source Sans 3 400/500/600 plus l'italique 400,
 * IBM Plex Mono 400/500/600.
 */
const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
  variable: "--font-sora",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-source-sans",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "LMS OFPPT",
  description: "Plateforme de gestion de formation — LMS OFPPT",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${sora.variable} ${sourceSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
