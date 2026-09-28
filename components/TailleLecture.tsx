"use client";

import { useEffect, useRef, useState } from "react";
import { AArrowDown, AArrowUp } from "lucide-react";
import {
  CLE_LECTURE,
  TAILLES_LECTURE,
  TAILLE_LECTURE_DEFAUT,
  appliquerTailleLecture,
} from "@/lib/lecture";

/**
 * A− / A+ : chacun règle la taille de sa lecture.
 *
 * La demande est venue des stagiaires, et elle est juste : un cours se lit
 * longtemps, sur un téléphone tenu à bout de bras ou sur un écran d'atelier à
 * un mètre. Aucune taille unique ne convient aux deux, et celle qu'on choisit
 * par défaut est forcément un compromis que quelqu'un paie.
 *
 * Le réglage vit dans le navigateur, pas en base : il dépend de l'écran qu'on
 * a sous les yeux, pas de la personne. Le même stagiaire veut du grand sur son
 * téléphone et du normal sur le poste de la salle — un réglage suivi de compte
 * en compte lui imposerait le mauvais des deux.
 *
 * Il ne change qu'une variable CSS, sur la racine du document : tout le texte
 * suivi s'exprime en `em` par rapport à elle (voir `.texte-lecture`). Rien
 * n'est recalculé, rien ne repart au serveur.
 */
export default function TailleLecture() {
  const [rang, setRang] = useState(() =>
    TAILLES_LECTURE.indexOf(TAILLE_LECTURE_DEFAUT),
  );
  /**
   * Le cran courant, lisible tout de suite.
   *
   * Deux appuis rapides sur A+ tombent dans le même rendu : tous deux
   * liraient `rang` à sa valeur d'avant et calculeraient le même cran, si
   * bien que le second appui ne faisait rien. Mesuré : deux appuis ne
   * montaient que d'un cran, et quatre appuis sur A− n'atteignaient jamais le
   * plus petit. La référence, elle, est à jour dès le premier.
   */
  const rangCourant = useRef(rang);

  // Au montage seulement : le script d'amorçage a déjà posé la bonne taille
  // avant le premier affichage, on se contente d'aligner l'état du bouton
  // dessus. Sans cela, « A− » resterait grisé alors que le texte est déjà au
  // plus petit.
  useEffect(() => {
    try {
      const garde = window.localStorage.getItem(CLE_LECTURE);
      const i = TAILLES_LECTURE.indexOf(Number(garde));
      if (i >= 0) {
        rangCourant.current = i;
        setRang(i);
      }
    } catch {
      // Navigation privée, stockage refusé : on reste au défaut.
    }
  }, []);

  function regler(delta: number) {
    const cible = Math.min(
      TAILLES_LECTURE.length - 1,
      Math.max(0, rangCourant.current + delta),
    );
    if (cible === rangCourant.current) return;
    rangCourant.current = cible;
    setRang(cible);
    appliquerTailleLecture(TAILLES_LECTURE[cible]!);
    try {
      window.localStorage.setItem(CLE_LECTURE, String(TAILLES_LECTURE[cible]));
    } catch {
      /* voir plus haut */
    }
  }

  const bouton =
    "flex h-10 w-10 items-center justify-center text-slate-2 transition-colors duration-150 ease-out hover:bg-paper hover:text-ink disabled:cursor-not-allowed disabled:text-muted disabled:hover:bg-transparent";

  return (
    <span
      role="group"
      aria-label="Taille du texte"
      className="inline-flex items-center overflow-hidden rounded-[10px] border border-border bg-surface"
    >
      <button
        type="button"
        onClick={() => regler(-1)}
        disabled={rang === 0}
        aria-label="Réduire la taille du texte"
        className={bouton}
      >
        <AArrowDown size={18} aria-hidden />
      </button>

      {/* Le rang, et non la valeur en pixels : « 19 px » ne dit rien à
          personne, quatre traits sur cinq se lisent d'un coup d'œil. */}
      <span
        aria-hidden
        className="flex items-center gap-[3px] border-x border-border px-2.5"
      >
        {TAILLES_LECTURE.map((_, i) => (
          <span
            key={i}
            className={`h-[3px] w-[3px] rounded-full ${
              i <= rang ? "bg-ink" : "bg-border-strong"
            }`}
          />
        ))}
      </span>
      <span className="sr-only" aria-live="polite">
        Taille {rang + 1} sur {TAILLES_LECTURE.length}
      </span>

      <button
        type="button"
        onClick={() => regler(1)}
        disabled={rang === TAILLES_LECTURE.length - 1}
        aria-label="Agrandir la taille du texte"
        className={bouton}
      >
        <AArrowUp size={18} aria-hidden />
      </button>
    </span>
  );
}
