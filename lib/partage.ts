/**
 * Types du partage de contenu entre séances parallèles (§4.3bis).
 *
 * Hors du fichier d'action : un module « use server » n'exporte que des
 * fonctions asynchrones.
 */

export type SeanceParallele = {
  id: string;
  groupeNom: string;
  date: string | null;
  heure_debut: string | null;
  heure_fin: string | null;
  objectif: string | null;
  /** Vrai si les deux séances partagent déjà le même contenu. */
  dejaLiee: boolean;
  /** Vrai si cette séance-là porte déjà une fiche ou un support. */
  aDuContenu: boolean;
};

/**
 * Ce que le formateur peut proposer depuis la séance qu'il regarde.
 *
 * `mienAvecContenu` décide du sens du partage : celui qui a écrit la fiche la
 * donne, il ne l'abandonne pas. Sans cette information, l'écran de la séance
 * source proposait de remplacer sa propre fiche par celle — souvent vide — du
 * groupe parallèle.
 */
export type PropositionsPartage = {
  mienAvecContenu: boolean;
  paralleles: SeanceParallele[];
};
