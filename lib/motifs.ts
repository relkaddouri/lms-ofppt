/**
 * Jours ouvrés du motif hebdomadaire.
 *
 * Ici et non dans l'action : un fichier « use server » ne peut exporter que
 * des fonctions asynchrones, une constante y fait échouer le module entier.
 * Numérotation `isodow` de Postgres — 1 = lundi.
 */
export const JOURS = [
  { valeur: 1, court: "Lun", long: "Lundi" },
  { valeur: 2, court: "Mar", long: "Mardi" },
  { valeur: 3, court: "Mer", long: "Mercredi" },
  { valeur: 4, court: "Jeu", long: "Jeudi" },
  { valeur: 5, court: "Ven", long: "Vendredi" },
  { valeur: 6, court: "Sam", long: "Samedi" },
] as const;
