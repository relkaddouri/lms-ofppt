"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  FileCheck2,
  Newspaper,
} from "lucide-react";

/**
 * Navigation de l'espace stagiaire, sous deux formes.
 *
 * Sur téléphone — l'usage principal — une barre inférieure fixe, là où le
 * pouce arrive. Sur écran large, la même liste passe en ligne dans l'en-tête :
 * une barre collée en bas d'un écran de bureau n'a pas de sens, et laisser la
 * page en colonne étroite gâcherait la place disponible.
 */
export const ONGLETS = [
  { href: "/espace-stagiaire/fil", libelle: "Fil", Icone: Newspaper },
  { href: "/espace-stagiaire/cours", libelle: "Cours", Icone: BookOpen },
  { href: "/espace-stagiaire/devoirs", libelle: "Devoirs", Icone: ClipboardList },
  { href: "/espace-stagiaire/controles", libelle: "Contrôles", Icone: FileCheck2 },
  {
    href: "/espace-stagiaire/emploi-du-temps",
    libelle: "Emploi du temps",
    // À cinq onglets, « Emploi du temps » déborde de sa case sur un écran de
    // 375 px : la barre basse en montre la version courte.
    libelleCourt: "Planning",
    Icone: CalendarDays,
  },
] as const;

export function NavigationHaute() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navigation principale" className="hidden md:block">
      <ul className="flex gap-1">
        {ONGLETS.map(({ href, libelle, Icone }) => {
          const actif = pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={actif ? "page" : undefined}
                className={`flex min-h-[44px] items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                  actif
                    ? "bg-mint font-medium text-forest"
                    : "text-slate hover:bg-mist hover:text-ink"
                }`}
              >
                <Icone className="h-4 w-4 shrink-0" aria-hidden />
                {libelle}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function NavigationBasse() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto flex max-w-lg">
        {ONGLETS.map((onglet) => {
          const { href, libelle, Icone } = onglet;
          const court = "libelleCourt" in onglet ? onglet.libelleCourt : libelle;
          const actif = pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={actif ? "page" : undefined}
                className="flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1 py-2"
              >
                <span
                  className={`flex h-7 w-11 items-center justify-center rounded-full transition-colors ${
                    actif ? "bg-mint text-forest" : "text-slate"
                  }`}
                >
                  <Icone className="h-5 w-5" aria-hidden />
                </span>
                <span
                  className={`whitespace-nowrap text-[10px] leading-tight ${
                    actif ? "font-medium text-forest" : "text-slate"
                  }`}
                >
                  {court}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
