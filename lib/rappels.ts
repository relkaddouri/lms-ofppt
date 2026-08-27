import { HEURES_PAR_CONTROLE } from "@/lib/planification";

/**
 * Rappels de contrôle, calculés sur les heures réellement faites.
 *
 * Le PRD fixe un contrôle continu tous les 30 heures. Appliqué tel quel, un
 * module de 25 heures n'en déclencherait jamais aucun, alors qu'il doit lui
 * aussi être évalué. Le seuil devient donc proportionnel en dessous de la
 * durée où 30 heures représentent le tiers du module — soit 90 heures.
 *
 * Ce module ne déclenche rien : il dit au formateur qu'une échéance est
 * atteinte, la préparation reste son geste.
 */

/** Durée au-delà de laquelle le seuil de 30 heures s'applique tel quel. */
export const DUREE_STANDARD = HEURES_PAR_CONTROLE * 3;

export type EtatRappel = "aucun" | "a_preparer" | "en_retard";

export type Rappel = {
  /** Seuil effectif entre deux contrôles, en heures. */
  seuil: number;
  /** Échéances théoriques, en heures cumulées. */
  echeances: number[];
  /** Nombre d'échéances franchies par les heures faites. */
  franchies: number;
  /** Contrôles déjà validés ou administrés sur ce couple. */
  couverts: number;
  /** Prochaine échéance non encore franchie, en heures. */
  prochaine: number | null;
  /** Heures restant avant la prochaine échéance. */
  restantAvantProchaine: number | null;
  etat: EtatRappel;
  libelle: string | null;
};

/**
 * Seuil applicable à un module.
 *
 * Sur 90 heures ou plus, c'est 30 heures — la règle du PRD. En dessous, le
 * tiers de la masse horaire, ce qui donne deux contrôles continus puis
 * l'épreuve de fin de module, quelle que soit la durée.
 */
export function seuilControle(masseHoraire: number): number {
  if (masseHoraire <= 0) return 0;
  return masseHoraire >= DUREE_STANDARD
    ? HEURES_PAR_CONTROLE
    : Math.round((masseHoraire / 3) * 2) / 2;
}

export function calculerRappel(
  masseHoraire: number,
  heuresFaites: number,
  controlesCouverts: number,
): Rappel {
  const seuil = seuilControle(masseHoraire);
  if (seuil <= 0) {
    return {
      seuil: 0,
      echeances: [],
      franchies: 0,
      couverts: controlesCouverts,
      prochaine: null,
      restantAvantProchaine: null,
      etat: "aucun",
      libelle: null,
    };
  }

  // Les échéances intermédiaires sont des contrôles continus ; la fin du
  // module est l'épreuve de fin de module, toujours présente.
  const echeances: number[] = [];
  for (let h = seuil; h < masseHoraire; h += seuil) {
    echeances.push(Math.round(h * 2) / 2);
  }
  echeances.push(masseHoraire);

  const franchies = echeances.filter((e) => heuresFaites >= e).length;
  const prochaine = echeances[franchies] ?? null;

  const manquants = franchies - controlesCouverts;
  const dernierFranchi = franchies > 0 ? echeances[franchies - 1] : null;
  const estEfm = dernierFranchi !== null && dernierFranchi >= masseHoraire;

  let etat: EtatRappel = "aucun";
  let libelle: string | null = null;

  if (manquants === 1) {
    etat = "a_preparer";
    libelle = estEfm
      ? "EFM à préparer — le module est terminé"
      : `Contrôle continu ${franchies} à préparer`;
  } else if (manquants > 1) {
    // Deux échéances franchies sans contrôle : le retard se dit, il ne se
    // devine pas.
    etat = "en_retard";
    libelle = `${manquants} contrôles en retard`;
  }

  return {
    seuil,
    echeances,
    franchies,
    couverts: controlesCouverts,
    prochaine,
    restantAvantProchaine:
      prochaine !== null ? Math.round((prochaine - heuresFaites) * 2) / 2 : null,
    etat,
    libelle,
  };
}
