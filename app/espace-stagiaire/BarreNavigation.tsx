"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ClipboardList, FileCheck2, Newspaper } from "lucide-react";

/**
 * Navigation de l'espace stagiaire.
 *
 * Barre inférieure fixe, quatre onglets, jamais de barre latérale : le
 * stagiaire consulte depuis son téléphone, le pouce atteint le bas de l'écran.
 * Chaque cible fait au moins 44 px de côté (design_system.md).
 */
const ONGLETS = [
  { href: "/espace-stagiaire/fil", libelle: "Fil", Icone: Newspaper },
  { href: "/espace-stagiaire/devoirs", libelle: "Devoirs", Icone: ClipboardList },
  { href: "/espace-stagiaire/controles", libelle: "Contrôles", Icone: FileCheck2 },
  {
    href: "/espace-stagiaire/emploi-du-temps",
    libelle: "Emploi du temps",
    Icone: CalendarDays,
  },
] as const;

export default function BarreNavigation() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-lg">
        {ONGLETS.map(({ href, libelle, Icone }) => {
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
                  {libelle}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
