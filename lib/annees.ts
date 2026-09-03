/**
 * L'année scolaire, hors fichier « use server ».
 *
 * Le type et les libellés vivent ici : un module d'action n'exporte que des
 * fonctions asynchrones.
 */

export type AnneeScolaire = {
  id: string;
  libelle: string;
  dateDebut: string;
  dateFin: string;
};

/**
 * Année scolaire en cours au sens du calendrier de formation : elle bascule en
 * septembre, pas en janvier.
 */
export function libelleAnneeCourante(reference = new Date()): string {
  const an = reference.getFullYear();
  const debut = reference.getMonth() >= 8 ? an : an - 1;
  return `${debut}/${debut + 1}`;
}

/** Vrai si la date du jour tombe dans la période de l'année. */
export function estEnCours(annee: AnneeScolaire, aujourdhui = new Date()): boolean {
  const jour = aujourdhui.toISOString().slice(0, 10);
  return jour >= annee.dateDebut && jour <= annee.dateFin;
}
