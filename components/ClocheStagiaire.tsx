"use client";

import Cloche from "./Cloche";
import { getNotificationsStagiaire } from "@/app/actions/notifications-stagiaire";

/**
 * La cloche du stagiaire (PRD §4.5).
 *
 * Même cloche que celle du formateur, trois choses en moins : ce qu'elle lit,
 * ce qu'elle dit, et ce qu'elle compte. Chez lui une notification est une
 * tâche, et la pastille un reste à faire ; ici c'est ce qui vient d'arriver
 * dans le groupe, et la pastille ne compte que ce qu'il n'a pas encore
 * regardé — il n'a rien à traiter, donc rien ne se résout.
 */
export default function ClocheStagiaire() {
  return (
    <Cloche
      charger={getNotificationsStagiaire}
      titre="Nouveautés"
      resume={(n) =>
        n === 0
          ? "Rien de neuf ces deux dernières semaines."
          : `${n} nouveauté${n > 1 ? "s" : ""} dans votre groupe`
      }
      vide="Aucune annonce, aucun commentaire, aucune réponse depuis deux semaines."
      cle="nouveautes"
      mesure="nouveaux"
      className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-slate-2 transition-colors duration-150 ease-out hover:bg-paper hover:text-ink"
    />
  );
}
