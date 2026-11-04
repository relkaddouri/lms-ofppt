"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatDateJour } from "@/lib/format";
import type { SeanceVoisine } from "@/app/actions/seances";

/**
 * Aller d'une séance à la précédente ou à la suivante sans repasser par la
 * progression (demande du 04/11/2026).
 *
 * Deux flèches, nommées par la date et l'objectif de la séance où elles
 * mènent, et les touches ← et → du clavier — sauf pendant une saisie, où
 * elles déplacent le curseur.
 */
export default function NavigationSeances({
  groupeId,
  precedente,
  suivante,
}: {
  groupeId: string;
  precedente: SeanceVoisine | null;
  suivante: SeanceVoisine | null;
}) {
  const router = useRouter();
  const lien = (s: SeanceVoisine) => `/groupes/${groupeId}/seances/${s.id}`;

  useEffect(() => {
    function touche(e: KeyboardEvent) {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const cible = e.target as HTMLElement | null;
      if (
        cible &&
        (cible.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(cible.tagName))
      ) {
        return;
      }
      const vers =
        e.key === "ArrowLeft" ? precedente : e.key === "ArrowRight" ? suivante : null;
      if (!vers) return;
      e.preventDefault();
      router.push(`/groupes/${groupeId}/seances/${vers.id}`);
    }
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [router, groupeId, precedente, suivante]);

  if (!precedente && !suivante) return null;

  const nom = (s: SeanceVoisine) =>
    [
      formatDateJour(s.date, { court: true }),
      [s.module, s.objectif].filter(Boolean).join(" "),
    ]
      .filter(Boolean)
      .join(" · ");

  const classe =
    "inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-slate-2 transition-colors duration-150 ease-out hover:bg-wash hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-encre";

  return (
    <nav aria-label="Séances voisines" className="flex items-center gap-1">
      {precedente ? (
        <Link
          href={lien(precedente)}
          className={classe}
          title="Séance précédente (←)"
        >
          <ChevronLeft size={16} aria-hidden />
          <span className="hidden sm:inline">{nom(precedente)}</span>
          <span className="sm:hidden">Précédente</span>
        </Link>
      ) : null}
      {suivante ? (
        <Link
          href={lien(suivante)}
          className={classe}
          title="Séance suivante (→)"
        >
          <span className="hidden sm:inline">{nom(suivante)}</span>
          <span className="sm:hidden">Suivante</span>
          <ChevronRight size={16} aria-hidden />
        </Link>
      ) : null}
    </nav>
  );
}
