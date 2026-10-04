/**
 * Les gabarits qu'un stagiaire peut déposer dans sa copie.
 *
 * Un contrôle de M202 demande une fiche persona, une empathy map, une user
 * journey map — et la zone de réponse n'offrait qu'un `textarea`. Le stagiaire
 * avait le choix entre rendre un paragraphe là où on attendait un tableau, ou
 * dessiner des barres verticales à la main en comptant les colonnes.
 *
 * Ce ne sont pas des formulaires : ce sont des tableaux Markdown pré-remplis,
 * qu'on complète et qu'on peut défaire. La structure est donnée, le contenu
 * reste entièrement de lui — c'est le contenu qu'on évalue.
 *
 * Markdown et non un format à part : la copie reste du texte, et toute la
 * chaîne qui existe déjà — correction, PDF, affichage — la traite sans rien
 * changer.
 */

export type Gabarit = {
  cle: string;
  libelle: string;
  /** Ce que le stagiaire en fera, dit en une ligne dans le menu. */
  aide: string;
  bloc: string;
};

export const GABARITS: readonly Gabarit[] = [
  {
    cle: "tableau",
    libelle: "Tableau",
    aide: "Trois colonnes, trois lignes — à agrandir au besoin",
    bloc: [
      "| Colonne 1 | Colonne 2 | Colonne 3 |",
      "| --- | --- | --- |",
      "|  |  |  |",
      "|  |  |  |",
      "|  |  |  |",
    ].join("\n"),
  },
  {
    cle: "persona",
    libelle: "Fiche persona",
    aide: "Profil, objectifs, motivations, points bloquants",
    bloc: [
      "**Persona : _prénom, âge, métier_**",
      "",
      "| Rubrique | Contenu |",
      "| --- | --- |",
      "| Profil | |",
      "| Contexte d'usage | |",
      "| Objectifs | |",
      "| Motivations | |",
      "| Points bloquants | |",
      "| Citation représentative | |",
    ].join("\n"),
  },
  {
    cle: "empathy",
    libelle: "Empathy map",
    aide: "Les quatre quadrants : pense, voit, dit, entend",
    bloc: [
      "**Empathy map : _nom de l'utilisateur_**",
      "",
      "| Pense et ressent | Voit |",
      "| --- | --- |",
      "|  |  |",
      "",
      "| Dit et fait | Entend |",
      "| --- | --- |",
      "|  |  |",
      "",
      "| Points de douleur | Bénéfices attendus |",
      "| --- | --- |",
      "|  |  |",
    ].join("\n"),
  },
  {
    cle: "journey",
    libelle: "User journey map",
    aide: "Étapes, actions, émotions, points de friction",
    bloc: [
      "**Parcours : _nom du parcours_**",
      "",
      "| Étape | Action de l'utilisateur | Ce qu'il ressent | Point de friction | Piste d'amélioration |",
      "| --- | --- | --- | --- | --- |",
      "| 1. |  |  |  |  |",
      "| 2. |  |  |  |  |",
      "| 3. |  |  |  |  |",
      "| 4. |  |  |  |  |",
    ].join("\n"),
  },
  {
    cle: "flow",
    libelle: "User flow",
    aide: "Les écrans et les décisions, étape par étape",
    bloc: [
      "**User flow : _nom du parcours_**",
      "",
      "1. **Écran de départ** — ce que l'utilisateur voit",
      "2. **Action** — ce qu'il fait",
      "3. **Décision** — si _condition_, alors … ; sinon …",
      "4. **Écran suivant** — …",
      "5. **Fin** — objectif atteint",
    ].join("\n"),
  },
];
