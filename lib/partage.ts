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
};
