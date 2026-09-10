"use client";

import { Menu, Search } from "lucide-react";
import Avatar from "./ui/Avatar";
import Cloche from "./Cloche";
import { getNotifications } from "@/app/actions/notifications";
import SelecteurAnnee from "./SelecteurAnnee";
import type { AnneeScolaire } from "@/lib/annees";
import type { Notification } from "@/app/actions/notifications";

/**
 * Ce qui vaut un carillon côté formateur.
 *
 * Le rappel qu'il se donne à lui-même — un contrôle laissé en brouillon,
 * seul genre du panneau dont il soit l'auteur — le remplit sans rien lui
 * apprendre : il vient de l'écrire. Restent les gestes des stagiaires, qui
 * eux arrivent sans prévenir.
 */
function vientDunStagiaire(n: Notification): boolean {
  return (
    n.genre === "question" ||
    n.genre === "commentaire" ||
    n.genre === "jaime" ||
    n.genre === "copie" ||
    n.genre === "devoir"
  );
}

export default function Topbar({
  email,
  notifications = 0,
  annees,
  anneeCouranteId,
  onMenuClick,
}: {
  email: string | null;
  /**
   * Compteur rendu par le serveur, affiché avant que la cloche ait relu.
   * Elle le tient à jour ensuite, toutes les quarante-cinq secondes.
   */
  notifications?: number;
  annees: AnneeScolaire[];
  anneeCouranteId: string | null;
  onMenuClick: () => void;
}) {
  return (
    <header className="flex h-[68px] flex-none items-center justify-between gap-6 border-b border-border bg-surface px-5 md:px-10">
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-[9px] p-1.5 text-slate-2 transition-colors duration-150 ease-out hover:bg-paper hover:text-ink focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_rgba(46,125,158,0.15)] md:hidden"
          aria-label="Ouvrir le menu"
        >
          <Menu size={20} aria-hidden />
        </button>
        {/* Le titre de l'application, pas celui de la page : la page porte son
            propre titre dans son en-tête, comme dans les écrans livrés. */}
        <span className="truncate font-display text-[15px] font-semibold tracking-[0.02em] text-ink">
          Pédago — Gestion pédagogique
        </span>
      </div>

      <div className="flex items-center gap-2.5">
        {/* PRD §4.15.2 : la portée de tout l'écran se change ici, comme on
            change de dossier de travail. Il précède les actions parce qu'il
            les conditionne toutes. */}
        <SelecteurAnnee annees={annees} couranteId={anneeCouranteId} />

        {/* La recherche est dans la maquette : elle reste visible, inerte,
            jusqu'à son atome (lot 3 de la revue). */}
        <button
          type="button"
          disabled
          aria-label="Rechercher"
          title="Recherche — disponible prochainement"
          className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-border bg-surface text-slate-2 disabled:cursor-not-allowed disabled:text-muted"
        >
          <Search size={18} strokeWidth={2} aria-hidden />
        </button>

        {/* La cloche sonne aussi de ce côté : une question de stagiaire posée
            pendant qu'on prépare une séance n'a aucune raison d'attendre le
            prochain coup d'œil au coin de l'écran. */}
        <Cloche
          charger={getNotifications}
          titre="Notifications"
          vide="Aucun contrôle en brouillon, aucune question sans réponse, aucune copie à corriger."
          resume={(n) =>
            n === 0
              ? "Rien n'attend votre intervention."
              : `${n} élément${n > 1 ? "s" : ""} en attente de votre intervention`
          }
          cle="notifications"
          mesure="total"
          sonnePour={vientDunStagiaire}
          compteInitial={notifications}
        />

        <span className="mx-1 hidden h-6 w-0.5 bg-separator sm:block" />
        <span className="hidden text-[13px] text-slate sm:block">{email}</span>
        <Avatar prenom={email ?? "F"} />
      </div>
    </header>
  );
}
