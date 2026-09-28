"use client";

import { useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

/**
 * Replier le sommaire du module, pour rendre la place au cours.
 *
 * Deux cent quatre-vingts pixels de table des matières se justifient quand on
 * cherche son chapitre ; beaucoup moins quand on lit. Et depuis qu'on peut
 * grossir le texte, la colonne qui reste rétrécit d'autant : au cran le plus
 * grand, une ligne de cours ne tenait plus que quelques mots.
 *
 * Le bouton ne porte pas l'état : c'est un attribut sur la racine du document
 * qui replie la colonne, et il est posé par le script d'amorçage avant le
 * premier pixel. Ce composant ne fait que le retourner et se mettre au
 * diapason — ce qui lui évite d'être la source de vérité d'une disposition
 * dont il n'est qu'une commande.
 */
const CLE = "pedago:sommaire";

export default function BasculeSommaire() {
  const [ouvert, setOuvert] = useState(true);

  useEffect(() => {
    setOuvert(
      document.documentElement.getAttribute("data-sommaire") !== "ferme",
    );
  }, []);

  function basculer() {
    const cible = !ouvert;
    setOuvert(cible);
    const racine = document.documentElement;
    if (cible) racine.removeAttribute("data-sommaire");
    else racine.setAttribute("data-sommaire", "ferme");
    try {
      window.localStorage.setItem(CLE, cible ? "ouvert" : "ferme");
    } catch {
      // Navigation privée, stockage refusé : le choix ne tient que pour la
      // page ouverte, ce qui reste préférable à un bouton qui ne fait rien.
    }
  }

  const Icone = ouvert ? PanelLeftClose : PanelLeftOpen;

  return (
    <button
      type="button"
      onClick={basculer}
      aria-pressed={!ouvert}
      aria-label={ouvert ? "Replier le sommaire" : "Afficher le sommaire"}
      title={ouvert ? "Replier le sommaire" : "Afficher le sommaire"}
      // Sur téléphone, le sommaire est déjà un dépliant au-dessus du cours :
      // un second bouton pour la même chose n'y aurait aucun sens.
      //
      // Une icône seule, et carrée : le mot « Sommaire » à côté de « M202 —
      // Analyser les besoins des utilisateurs » faisait deux libellés pour
      // deux choses différentes sur la même ligne, et c'est le titre du module
      // qu'on venait y lire. Le nom reste, pour les lecteurs d'écran et au
      // survol.
      className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-border bg-surface text-slate-2 transition-colors duration-150 ease-out hover:border-border-strong hover:text-ink md:inline-flex"
    >
      <Icone size={17} aria-hidden />
    </button>
  );
}
