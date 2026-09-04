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

/**
 * Résultat d'un recalcul de placement (PRD §4.9).
 *
 * Un compte par groupe, parce que le formateur doit pouvoir vérifier que le
 * recalcul a bien touché ce qu'il croyait toucher — et voir tout de suite le
 * groupe qui n'a plus de créneau du tout.
 */
export type Replanification = {
  groupes: {
    nom: string;
    /** Séances « à faire » détachées de leur date avant replacement. */
    liberees: number;
    placees: number;
    heuresRestantes: number;
    /** Le motif ne réserve plus aucun créneau à ce groupe : rien n'a bougé. */
    sansCreneau: boolean;
  }[];
};

/** Le total de séances replacées, pour le message de retour. */
export function totalPlacees(r: Replanification): number {
  return r.groupes.reduce((t, g) => t + g.placees, 0);
}

/**
 * Ce que le recalcul a fait, en une phrase.
 *
 * Nommé groupe par groupe : « 96 séances replacées » sans dire pour qui ne
 * permet pas de vérifier que le recalcul a touché ce qu'on croyait toucher.
 */
export function messageReplanification(r: Replanification): string {
  if (r.groupes.length === 0) return "";
  return r.groupes
    .map((g) => {
      if (g.sansCreneau) {
        return `${g.nom} : plus aucun créneau, séances laissées en place`;
      }
      if (g.placees === 0) return `${g.nom} : rien à replacer`;
      const reste =
        g.heuresRestantes > 0
          ? `, ${g.heuresRestantes.toString().replace(".", ",")} h sans créneau`
          : "";
      return `${g.nom} : ${g.placees} séance${g.placees > 1 ? "s" : ""} replacée${g.placees > 1 ? "s" : ""}${reste}`;
    })
    .join(" · ");
}
