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
  title: "Pédago",
  description: "Plateforme de gestion pédagogique pour les formateurs OFPPT",
};

/**
 * Les réglages de lecture et d'apparence, posés avant le premier affichage.
 *
 * Ce script s'exécute pendant l'analyse du document, donc avant que le
 * navigateur ait peint quoi que ce soit. C'est la seule façon d'éviter le
 * défaut classique : la page apparaît à la taille par défaut, puis saute à
 * celle qu'on avait choisie une fois React arrivé. Un saut de texte sous les
 * yeux au chargement de chaque page est pire que l'absence du réglage.
 *
 * Il est court et sans dépendance exprès : il tourne avant tout le reste, et
 * une erreur ici bloquerait l'affichage. D'où le `try` qui avale tout —
 * navigation privée, stockage refusé : on garde les valeurs par défaut.
 */
const AMORCE = `(function(){try{
var t=localStorage.getItem('pedago:lecture');
if(t)document.documentElement.style.setProperty('--lecture',t+'px');
var a=localStorage.getItem('pedago:apparence');
if(a==='sombre')document.documentElement.setAttribute('data-theme','dark');
else if(a==='clair')document.documentElement.setAttribute('data-theme','light');
}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${sora.variable} ${sourceSans.variable} ${plexMono.variable} h-full antialiased`}
      /* Le script d'amorçage pose `data-theme` et `--lecture` sur cet élément
         avant que React n'arrive : celui-ci trouve donc des attributs que le
         serveur n'avait pas écrits, et le signale. C'est attendu, c'est même
         tout l'intérêt — le réglage doit être là avant le premier pixel. */
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: AMORCE }} />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
