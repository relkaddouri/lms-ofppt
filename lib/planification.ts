import { arrondi } from "@/lib/repartition";

/**
 * Découpage d'un module en séances, à partir de la répartition horaire.
 *
 * Le formateur enseigne par blocs : 5 h (une demi-journée complète), 3 h ou
 * 2 h 30. On compose donc chaque objectif avec ces blocs plutôt qu'avec une
 * durée arbitraire, et on alterne théorie et pratique dans l'ordre du
 * référentiel.
 */

/** Durées de séance réellement praticables, de la plus longue à la plus courte. */
export const BLOCS_SEANCE = [5, 3, 2.5] as const;

/** Seuil du PRD : un contrôle continu est proposé tous les 30 heures. */
export const HEURES_PAR_CONTROLE = 30;

export type ObjectifPlanifie = {
  id: string;
  code: string;
  intitule: string;
  heures_theoriques: number;
  heures_pratiques: number;
};

export type SeancePlanifiee = {
  ordre: number;
  suggestion_pedagogique_id: string;
  code: string;
  objectif: string;
  nature: "theorique" | "pratique";
  duree: number;
  /** Cumul d'heures atteint à la fin de cette séance. */
  cumul: number;
};

export type ControlePlanifie = {
  ordre: number;
  /** Après combien d'heures ce contrôle tombe. */
  cumul: number;
  libelle: string;
};

export type Plan = {
  seances: SeancePlanifiee[];
  controles: ControlePlanifie[];
  totalHeures: number;
};

/**
 * Découpe une durée en séances praticables.
 *
 * Un simple « prends le plus grand bloc qui tient » laisse des reliquats
 * inutilisables : 10 h 30 donnerait 5 + 5 + 0 h 30. On cherche donc d'abord une
 * décomposition exacte en blocs réels — 10 h 30 = 5 + 3 + 2 h 30 — en
 * privilégiant le moins de séances possible.
 *
 * Quand aucune combinaison ne tombe juste (1 h 30, par exemple), le reliquat
 * est ajouté à la dernière séance plutôt que d'en créer une trop courte pour
 * être placée dans un emploi du temps.
 */
export function decouperEnBlocs(heures: number): number[] {
  const cible = arrondi(heures);
  if (cible <= 0) return [];
  if (cible <= BLOCS_SEANCE[BLOCS_SEANCE.length - 1]) return [cible];

  // Les durées d'un module restent petites : l'énumération est immédiate.
  const max = Math.ceil(cible / BLOCS_SEANCE[2]) + 1;
  let meilleure: number[] | null = null;

  for (let n5 = 0; n5 * 5 <= cible; n5++) {
    for (let n3 = 0; n5 * 5 + n3 * 3 <= cible && n3 <= max; n3++) {
      const reste = arrondi(cible - n5 * 5 - n3 * 3);
      if (reste < 0) continue;
      const n25 = reste / 2.5;
      if (!Number.isInteger(n25)) continue;
      const total = n5 + n3 + n25;
      // À nombre de séances égal, on préfère les blocs longs : une demi-journée
      // pleine vaut mieux que deux fragments.
      if (
        meilleure === null ||
        total < meilleure.length ||
        (total === meilleure.length && n5 > meilleure.filter((b) => b === 5).length)
      ) {
        meilleure = [
          ...Array(n5).fill(5),
          ...Array(n3).fill(3),
          ...Array(n25).fill(2.5),
        ];
      }
    }
  }
  if (meilleure) return meilleure;

  // Aucune combinaison exacte : on compose au plus près, puis on absorbe le
  // reliquat dans la dernière séance.
  const blocs: number[] = [];
  let reste = cible;
  while (reste >= BLOCS_SEANCE[BLOCS_SEANCE.length - 1]) {
    const bloc = BLOCS_SEANCE.find((b) => b <= reste)!;
    blocs.push(bloc);
    reste = arrondi(reste - bloc);
  }
  if (reste > 0) {
    if (blocs.length === 0) blocs.push(reste);
    else blocs[blocs.length - 1] = arrondi(blocs[blocs.length - 1] + reste);
  }
  return blocs;
}

export function construirePlan(objectifs: ObjectifPlanifie[]): Plan {
  const seances: SeancePlanifiee[] = [];
  const controles: ControlePlanifie[] = [];
  let cumul = 0;
  let ordre = 0;
  let prochainSeuil = HEURES_PAR_CONTROLE;

  for (const o of objectifs) {
    // Théorie d'abord, pratique ensuite : on n'applique pas ce qu'on n'a pas
    // encore vu.
    const suites: { nature: "theorique" | "pratique"; heures: number }[] = [
      { nature: "theorique", heures: o.heures_theoriques },
      { nature: "pratique", heures: o.heures_pratiques },
    ];

    for (const { nature, heures } of suites) {
      for (const duree of decouperEnBlocs(heures)) {
        cumul = arrondi(cumul + duree);
        seances.push({
          ordre: ordre++,
          suggestion_pedagogique_id: o.id,
          code: o.code,
          objectif: o.intitule,
          nature,
          duree,
          cumul,
        });

        // Le contrôle est proposé dès que le seuil est franchi, à la fin de la
        // séance en cours : on n'interrompt pas une séance pour évaluer.
        if (cumul >= prochainSeuil) {
          controles.push({
            ordre: controles.length + 1,
            cumul,
            libelle: `Contrôle continu ${controles.length + 1}`,
          });
          prochainSeuil += HEURES_PAR_CONTROLE;
        }
      }
    }
  }

  return { seances, controles, totalHeures: cumul };
}
