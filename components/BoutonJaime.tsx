"use client";

import { useRef, useState } from "react";
import { Heart } from "lucide-react";

/**
 * « J'aime », et la volée de cœurs qui l'accompagne.
 *
 * Le mot a disparu du bouton : dans un fil, le cœur dit tout, et deux libellés
 * côte à côte prenaient la moitié de la largeur d'un téléphone pour répéter ce
 * que les icônes montrent. Reste le compte, qui est la seule information.
 *
 * Le geste, lui, est rendu : le cœur bat une fois et une poignée d'autres
 * s'échappent vers le haut. C'est la seule réponse que reçoit quelqu'un qui
 * aime une annonce — la valeur ne change que d'une unité, et sur une liste de
 * seize annonces on ne sait plus si le doigt a porté. Rien de cela ne part au
 * serveur : l'animation vit dans le navigateur, et l'écriture suit son cours.
 *
 * Les cœurs ne s'envolent qu'au « j'aime », jamais au retrait : on ne fête pas
 * un geste qu'on annule.
 */

/** Combien de cœurs s'échappent. Cinq : une volée, pas un feu d'artifice. */
const VOLEE = 5;

type Envol = { id: number; derive: number; tourne: number; retard: number };

export default function BoutonJaime({
  aime,
  total,
  onBasculer,
  petit = false,
  libelle = "cette annonce",
}: {
  aime: boolean;
  total: number;
  onBasculer: () => void;
  /** Version réduite, pour un commentaire plutôt qu'une annonce. */
  petit?: boolean;
  /**
   * Ce que la commande nomme, pour le lecteur d'écran — au complet, article
   * compris : le mot disparu du bouton doit se retrouver là.
   */
  libelle?: string;
}) {
  const [envols, setEnvols] = useState<Envol[]>([]);
  const suivant = useRef(0);

  function cliquer() {
    if (!aime) {
      // Chaque cœur part avec sa propre dérive, sa propre inclinaison et son
      // propre retard : cinq trajectoires identiques donneraient un seul gros
      // cœur qui monte.
      const volee: Envol[] = Array.from({ length: VOLEE }, () => ({
        id: suivant.current++,
        derive: Math.round((Math.random() - 0.5) * 54),
        tourne: Math.round((Math.random() - 0.5) * 60),
        retard: Math.round(Math.random() * 120),
      }));
      setEnvols((e) => [...e, ...volee]);
    }
    onBasculer();
  }

  const taille = petit ? 15 : 17;

  return (
    <button
      type="button"
      onClick={cliquer}
      aria-pressed={aime}
      aria-label={aime ? `Ne plus aimer ${libelle}` : `Aimer ${libelle}`}
      className={`relative flex items-center gap-1.5 font-semibold transition-colors duration-150 ease-out ${
        petit
          ? "min-h-[34px] rounded-[9px] px-2 py-1 text-[13px]"
          : "min-h-[44px] rounded-[11px] border px-[15px] py-[11px] text-sm"
      } ${
        aime
          ? petit
            ? "text-coral"
            : "border-coral bg-coral-wash text-coral"
          : petit
            ? "text-slate-2 hover:text-ink"
            : "border-border-strong bg-surface text-body hover:border-ink hover:bg-paper"
      }`}
    >
      {/* Les cœurs s'échappent du cœur lui-même, et non d'un coin du bouton :
          ancrés dessus, ils partent du bon endroit quelle que soit la taille
          du bouton. Rien ici ne coupe ni ne reçoit de clic. */}
      <span className="relative flex shrink-0">
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 h-0 w-0"
        >
          {envols.map((e) => (
            <Heart
              key={e.id}
              size={petit ? 12 : 14}
              className="coeur-envol absolute fill-coral text-coral"
              style={
                {
                  "--derive": `${e.derive}px`,
                  "--tourne": `${e.tourne}deg`,
                  animationDelay: `${e.retard}ms`,
                } as React.CSSProperties
              }
              onAnimationEnd={() =>
                setEnvols((liste) => liste.filter((x) => x.id !== e.id))
              }
            />
          ))}
        </span>

        <Heart
          size={taille}
          className={aime ? "coeur-bat fill-coral" : ""}
          aria-hidden
        />
      </span>

      {total > 0 ? (
        <span className="font-mono font-medium tabular-nums">{total}</span>
      ) : null}
    </button>
  );
}
