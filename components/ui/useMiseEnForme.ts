"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";

/**
 * Agir sur la sélection d'une zone de texte, pour une barre de mise en forme.
 *
 * Écrit d'abord pour la réponse du formateur dans le fil, puis réclamé par la
 * copie du stagiaire, qui doit pouvoir rendre un tableau sans connaître la
 * syntaxe Markdown. Les deux manipulent une sélection de la même façon : le
 * crochet est ici plutôt que recopié, pour que la correction d'un défaut
 * profite aux deux.
 *
 * La barre n'est qu'un raccourci : elle écrit la syntaxe dans le texte, elle
 * ne cache rien. Qui connaît le Markdown l'ignore ; qui ne le connaît pas
 * l'apprend en voyant ce que chaque bouton a écrit.
 */
export function useMiseEnForme(
  texte: string,
  setTexte: (valeur: string) => void,
): {
  zone: RefObject<HTMLTextAreaElement | null>;
  entourer: (avant: string, apres: string, modele: string) => void;
  prefixer: (prefixe: (i: number) => string) => void;
  inserer: (bloc: string) => void;
} {
  const zone = useRef<HTMLTextAreaElement>(null);

  // La sélection à rétablir après une mise en forme. Appliquée une fois le
  // nouveau texte rendu, et non dans un `requestAnimationFrame` : React remet
  // le curseur en fin de champ en réécrivant sa valeur, et une image
  // d'animation ne vient pas toujours après — jamais dans un onglet en
  // arrière-plan, où le navigateur les suspend.
  const selectionAVenir = useRef<[number, number] | null>(null);

  useLayoutEffect(() => {
    const el = zone.current;
    const cible = selectionAVenir.current;
    if (!el || !cible) return;
    selectionAVenir.current = null;
    el.focus();
    el.setSelectionRange(cible[0], cible[1]);
  }, [texte]);

  /**
   * Entoure la sélection, ou insère le modèle au curseur.
   *
   * La sélection est restaurée après coup, sur le texte entouré : on peut
   * enchaîner gras puis italique sans resélectionner.
   */
  function entourer(avant: string, apres: string, modele: string) {
    const el = zone.current;
    if (!el) return;
    const debut = el.selectionStart;
    const fin = el.selectionEnd;
    const choisi = texte.slice(debut, fin) || modele;
    const suite =
      texte.slice(0, debut) + avant + choisi + apres + texte.slice(fin);
    selectionAVenir.current = [
      debut + avant.length,
      debut + avant.length + choisi.length,
    ];
    setTexte(suite);
  }

  /** Préfixe chaque ligne sélectionnée — listes et citations. */
  function prefixer(prefixe: (i: number) => string) {
    const el = zone.current;
    if (!el) return;
    // On étend la sélection aux lignes entières : une liste qui commencerait au
    // milieu d'une phrase ne serait pas une liste.
    const debut = texte.lastIndexOf("\n", el.selectionStart - 1) + 1;
    const finLigne = texte.indexOf("\n", el.selectionEnd);
    const fin = finLigne === -1 ? texte.length : finLigne;
    const bloc = texte
      .slice(debut, fin)
      .split("\n")
      .map((l, i) => `${prefixe(i)}${l}`)
      .join("\n");
    selectionAVenir.current = [debut, debut + bloc.length];
    setTexte(texte.slice(0, debut) + bloc + texte.slice(fin));
  }

  /**
   * Insère un bloc entier — un tableau, un gabarit — sur ses propres lignes.
   *
   * Un tableau Markdown collé en plein milieu d'une phrase n'est pas un
   * tableau : il lui faut une ligne vide avant et après. On les ajoute si
   * elles manquent, et seulement si elles manquent, pour ne pas creuser le
   * texte à chaque insertion.
   */
  function inserer(bloc: string) {
    const el = zone.current;
    if (!el) return;
    const debut = el.selectionStart;
    const fin = el.selectionEnd;
    const avant = texte.slice(0, debut);
    const apres = texte.slice(fin);

    const sautAvant = avant === "" || avant.endsWith("\n\n") ? "" : avant.endsWith("\n") ? "\n" : "\n\n";
    const sautApres = apres === "" || apres.startsWith("\n\n") ? "" : apres.startsWith("\n") ? "\n" : "\n\n";

    const morceau = `${sautAvant}${bloc}${sautApres}`;
    // Le curseur se pose au début du bloc inséré : c'est là qu'on remplit.
    const place = debut + sautAvant.length;
    selectionAVenir.current = [place, place];
    setTexte(avant + morceau + apres);
  }

  return { zone, entourer, prefixer, inserer };
}
