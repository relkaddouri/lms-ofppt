"use client";

import Cloche from "./Cloche";
import { getNotificationsStagiaire } from "@/app/actions/notifications-stagiaire";

/**
 * La cloche du stagiaire (PRD §4.5).
 *
 * Même cloche que celle du formateur, deux choses en moins : ce qu'elle lit et
 * ce qu'elle dit. Chez lui une notification est une tâche qui disparaît quand
 * elle est faite ; ici c'est ce qui vient d'arriver dans le groupe, et rien ne
 * se résout. Les deux pastilles comptent la même chose — ce qui est arrivé
 * depuis le dernier regard.
 */
export default function ClocheStagiaire({
  apercuInitial = null,
}: {
  /** Ce que le gabarit a lu en rendant la page (audit du 26/09/2026). */
  apercuInitial?: { id: string; date: string }[] | null;
}) {
  return (
    <Cloche
      charger={getNotificationsStagiaire}
      apercuInitial={apercuInitial}
      titre="Nouveautés"
      resume={(n) =>
        n === 0
          ? "Rien de neuf ces deux dernières semaines."
          : `${n} nouveauté${n > 1 ? "s" : ""} dans votre groupe`
      }
      vide="Aucune annonce, aucun commentaire, aucune réponse depuis deux semaines."
      cle="nouveautes"
      className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-slate-2 transition-colors duration-150 ease-out hover:bg-paper hover:text-ink"
    />
  );
}
