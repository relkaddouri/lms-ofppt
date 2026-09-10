"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import PanneauNotifications from "./PanneauNotifications";
import { getNotificationsStagiaire } from "@/app/actions/notifications-stagiaire";

/**
 * La cloche du stagiaire (PRD §4.5).
 *
 * Le panneau est celui du formateur, avec une autre source : ce qui vient de
 * se passer plutôt que ce qui attend une action. D'où le résumé et l'état vide
 * réécrits — « en attente de votre intervention » n'a aucun sens ici, le
 * stagiaire n'a rien à traiter.
 *
 * Le compteur n'a pas d'accusé de lecture en base : rien à marquer, puisque
 * rien ne se résout. Il compte ce qui est arrivé depuis la dernière ouverture,
 * retenue dans le navigateur. C'est une commodité, pas un état partagé : sur
 * un autre téléphone, la pastille repart de zéro, ce qui est sans conséquence
 * — au pire elle annonce du déjà-lu.
 */
const CLE = "pedago:nouveautes-vues";

function derniereOuverture(): string | null {
  try {
    return window.localStorage.getItem(CLE);
  } catch {
    // Navigation privée, stockage refusé : la pastille comptera tout, ce qui
    // reste préférable à un écran blanc.
    return null;
  }
}

export default function ClocheStagiaire() {
  const [ouvert, setOuvert] = useState(false);
  const [nouvelles, setNouvelles] = useState(0);

  useEffect(() => {
    let annule = false;
    getNotificationsStagiaire()
      .then((liste) => {
        if (annule) return;
        const vu = derniereOuverture();
        setNouvelles(
          vu ? liste.filter((n) => n.date > vu).length : liste.length,
        );
      })
      // Silencieux : une pastille manquante ne mérite pas d'alerte.
      .catch(() => {});
    return () => {
      annule = true;
    };
  }, []);

  const ouvrir = useCallback(() => {
    setOuvert(true);
    setNouvelles(0);
    try {
      window.localStorage.setItem(CLE, new Date().toISOString());
    } catch {
      /* voir `derniereOuverture` */
    }
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={ouvrir}
        aria-haspopup="dialog"
        aria-label={
          nouvelles > 0 ? `Nouveautés (${nouvelles})` : "Nouveautés"
        }
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-slate-2 transition-colors duration-150 ease-out hover:bg-paper hover:text-ink"
      >
        <Bell size={18} aria-hidden />
        {nouvelles > 0 ? (
          <span className="absolute -right-[5px] -top-[5px] flex h-[19px] min-w-[19px] items-center justify-center rounded-full border-2 border-surface bg-coral px-1 font-mono text-[11px] font-semibold text-white">
            {nouvelles > 9 ? "9+" : nouvelles}
          </span>
        ) : null}
      </button>

      <PanneauNotifications
        ouvert={ouvert}
        onFermer={() => setOuvert(false)}
        charger={getNotificationsStagiaire}
        titre="Nouveautés"
        resume={(n) =>
          n === 0
            ? "Rien de neuf ces deux dernières semaines."
            : `${n} nouveauté${n > 1 ? "s" : ""} dans votre groupe`
        }
        vide="Aucune annonce, aucun commentaire, aucune réponse depuis deux semaines."
      />
    </>
  );
}
