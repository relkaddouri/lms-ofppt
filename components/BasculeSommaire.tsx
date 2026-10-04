"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

/**
 * Replier le sommaire du module, pour rendre la place au cours.
 *
 * Deux cent quatre-vingts pixels de table des matières se justifient quand on
 * cherche son chapitre ; beaucoup moins quand on lit. Et depuis qu'on peut
 * grossir le texte, la colonne qui reste rétrécit d'autant : au cran le plus
 * grand, une ligne de cours ne tenait plus que quelques mots.
 *
 * Deux formes pour un même geste, et jamais les deux à l'écran en même temps :
 *
 * - `entete` : une icône dans l'en-tête du panneau, au fil du contenu. Une
 *   première version la posait en flottant, à cheval sur le bord de la
 *   colonne. Elle mordait sur le titre du module d'un côté et sur le fil
 *   d'Ariane de l'autre, et il fallait la déplacer à chaque changement d'état
 *   pour qu'elle cesse de recouvrir quelque chose. Dans le flux, elle ne
 *   recouvre rien et ne bouge jamais.
 * - `rail` : le rail replié **est** le bouton. Un rail de quarante-huit
 *   pixels avec une commande posée à côté demandait au lecteur de viser ;
 *   rendu cliquable en entier, il devient une cible de toute sa hauteur.
 *
 * Le panneau ne reparaît pas au survol. Une version l'a fait, et il surgissait
 * dès qu'on passait la souris par là pour aller ailleurs. On ouvre d'un clic,
 * on referme d'un clic, et rien ne bouge entre les deux.
 *
 * ── Pourquoi aucun état ici ──────────────────────────────────────────────
 *
 * Chaque forme ne peut faire qu'une chose : le rail n'est visible que replié,
 * donc il ouvre ; l'en-tête n'est visible que déployé, donc il replie. C'est
 * la disposition qui décide, et elle est portée par un attribut sur la racine
 * du document, posé par le script d'amorçage avant le premier pixel.
 *
 * Une version précédente tenait un état dans chaque bouton. Les deux vivaient
 * chacun de leur côté : replier depuis l'en-tête ne prévenait pas le rail, qui
 * se croyait encore déployé — et le clic suivant sur le rail repliait ce qui
 * l'était déjà. Le sommaire ne se rouvrait plus.
 */
const CLE = "pedago:sommaire";

function poser(ouvert: boolean) {
  const racine = document.documentElement;
  if (ouvert) racine.removeAttribute("data-sommaire");
  else racine.setAttribute("data-sommaire", "ferme");
  try {
    window.localStorage.setItem(CLE, ouvert ? "ouvert" : "ferme");
  } catch {
    // Navigation privée, stockage refusé : le choix ne tient que pour la page
    // ouverte, ce qui reste préférable à un bouton qui ne fait rien.
  }
}

export default function BasculeSommaire({
  variante,
  progression = 0,
  rang = 0,
  total = 0,
}: {
  variante: "entete" | "rail";
  /** Rail : l'avancement du module, en pourcentage. */
  progression?: number;
  /** Rail : le rang du chapitre lu, et le nombre total. */
  rang?: number;
  total?: number;
}) {
  if (variante === "rail") {
    return (
      <button
        type="button"
        onClick={() => poser(true)}
        aria-label={`Afficher le sommaire — chapitre ${rang} sur ${total}`}
        title="Afficher le sommaire"
        className="sommaire-rail hidden w-12 flex-col items-center gap-3 rounded-[14px] border border-border bg-surface py-3 text-slate-2 transition-colors duration-150 ease-out hover:border-border-strong hover:text-ink"
      >
        <PanelLeftOpen size={17} aria-hidden />

        {/* L'avancement du module, debout. Il se remplit par le haut, comme
            la liste qu'il résume se lit de haut en bas. */}
        <span
          aria-hidden
          className="flex h-32 w-1.5 overflow-hidden rounded-full bg-wash-strong"
        >
          <span
            className="w-full self-start rounded-full bg-green"
            style={{ height: `${progression}%` }}
          />
        </span>

        {/* Où l'on en est, en trois caractères : c'est la seule question
            qu'on se pose en lisant, et elle ne vaut pas de rouvrir le
            panneau pour y répondre. */}
        <span
          aria-hidden
          className="flex flex-col items-center font-mono text-[11px] leading-tight"
        >
          <span className="font-semibold text-ink">{rang || "—"}</span>
          <span className="text-muted">/{total}</span>
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => poser(false)}
      aria-label="Replier le sommaire"
      title="Replier le sommaire"
      className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-slate-light transition-colors duration-150 ease-out hover:bg-paper hover:text-ink"
    >
      <PanelLeftClose size={16} aria-hidden />
    </button>
  );
}
