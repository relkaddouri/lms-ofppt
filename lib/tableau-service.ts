/**
 * Le tableau de service, hors fichier « use server ».
 *
 * Le type et le calcul vivent ici parce qu'un fichier d'action ne peut
 * exporter que des fonctions asynchrones : une fonction synchrone y fait
 * échouer le rendu de toute l'application, avec un `tsc` vert.
 */

/**
 * Une ligne du tableau de service : une affectation groupe + module.
 *
 * Les quatre valeurs horaires reprennent les colonnes du document officiel
 * (PRD §4.13bis) : présentiel et distance, croisés avec le semestre. Rien
 * n'est agrégé — le document montre les quatre séparément, et c'est la somme
 * par colonne qu'il fait signer.
 */
export type LigneService = {
  id: string;
  filiere: string;
  groupe: string;
  annee: number | null;
  codeModule: string | null;
  module: string;
  presentielS1: number;
  fadS1: number;
  presentielS2: number;
  fadS2: number;
  /**
   * Part à distance dispensée conjointement avec un autre groupe. Le document
   * officiel laisse alors les deux cellules FAD vides sur cette ligne : le
   * formateur ne dispense ces heures qu'une fois.
   */
  fadMutualisee: boolean;
};

export type TableauService = {
  lignes: LigneService[];
  /** Spécialité de l'en-tête, déduite des groupes plutôt que ressaisie. */
  specialite: string | null;
};

/**
 * Les heures que porte réellement une ligne dans le tableau de service.
 *
 * Le présentiel compte toujours ; la part à distance ne compte que si elle
 * n'est pas mutualisée. C'est toute la différence entre la progression d'un
 * groupe — qui crédite ces heures — et la charge du formateur, qui ne les
 * compte qu'une fois (PRD §4.1bis et §4.13bis).
 */
export function heuresPortees(l: LigneService): {
  pS1: number;
  sS1: number;
  pS2: number;
  sS2: number;
} {
  return {
    pS1: l.presentielS1,
    sS1: l.fadMutualisee ? 0 : l.fadS1,
    pS2: l.presentielS2,
    sS2: l.fadMutualisee ? 0 : l.fadS2,
  };
}
