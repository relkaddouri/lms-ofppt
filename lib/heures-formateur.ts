/**
 * Suivi cumulatif des heures dispensées (PRD §4.10).
 *
 * Trois plafonds, de nature différente : la masse légale annuelle, qui ne se
 * dépasse qu'en heures supplémentaires ; le plafond mensuel de ces heures
 * supplémentaires ; leur plafond annuel. Les trois se surveillent ensemble —
 * rester sous l'un ne dit rien des deux autres.
 */

/**
 * Valeurs par défaut du PRD §4.10.
 *
 * Ce sont des points de départ, pas des constantes du produit : la charge
 * contractuelle varie d'un formateur à l'autre et se saisit dans les
 * paramètres.
 */
export const PLAFONDS_PAR_DEFAUT = {
  annuel: 910,
  supMensuel: 30,
  supAnnuel: 260,
} as const;

export type PlafondsFormateur = {
  heuresAnnuelles: number;
  heuresSupActives: boolean;
  plafondSupMensuel: number;
  plafondSupAnnuel: number;
};

export const PLAFONDS_INITIAUX: PlafondsFormateur = {
  heuresAnnuelles: PLAFONDS_PAR_DEFAUT.annuel,
  heuresSupActives: false,
  plafondSupMensuel: PLAFONDS_PAR_DEFAUT.supMensuel,
  plafondSupAnnuel: PLAFONDS_PAR_DEFAUT.supAnnuel,
};

/**
 * Cible hebdomadaire par défaut, quand aucune période n'en fixe une.
 * 910 h réparties sur les 35 semaines travaillées d'une année de formation.
 */
export const CIBLE_PAR_DEFAUT = 26;

/** Au-delà de ce taux d'occupation d'un plafond, on prévient. */
const SEUIL_ALERTE = 0.9;

export type Rythme = {
  date_debut: string;
  date_fin: string;
  heures_cible: number;
};

export type Semaine = {
  /** Lundi de la semaine, au format ISO. */
  lundi: string;
  heures: number;
  cible: number;
  /** Heures au-delà de la cible de cette semaine-là. */
  supplementaires: number;
};

export type NiveauAlerte = "aucun" | "proche" | "depasse";

export type Plafond = {
  libelle: string;
  valeur: number;
  plafond: number;
  taux: number;
  niveau: NiveauAlerte;
  message: string | null;
};

/** Cible applicable à une semaine, d'après les périodes déclarées. */
export function cibleDe(lundi: string, rythmes: Rythme[]): number {
  const r = rythmes.find((x) => lundi >= x.date_debut && lundi <= x.date_fin);
  return r ? Number(r.heures_cible) : CIBLE_PAR_DEFAUT;
}

function arrondi(h: number): number {
  return Math.round(h * 2) / 2;
}

export function construireSemaines(
  heuresParLundi: Map<string, number>,
  rythmes: Rythme[],
): Semaine[] {
  return [...heuresParLundi.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([lundi, heures]) => {
      const cible = cibleDe(lundi, rythmes);
      return {
        lundi,
        heures: arrondi(heures),
        cible,
        supplementaires: arrondi(Math.max(0, heures - cible)),
      };
    });
}

function evaluer(
  libelle: string,
  valeur: number,
  plafond: number,
  messageProche: string,
  messageDepasse: string,
): Plafond {
  const taux = plafond > 0 ? valeur / plafond : 0;
  const niveau: NiveauAlerte =
    taux > 1 ? "depasse" : taux >= SEUIL_ALERTE ? "proche" : "aucun";
  return {
    libelle,
    valeur: arrondi(valeur),
    plafond,
    taux,
    niveau,
    message:
      niveau === "depasse"
        ? messageDepasse
        : niveau === "proche"
          ? messageProche
          : null,
  };
}

export type BilanHeures = {
  /** Recopié du paramétrage : le suivi masque les heures sup si elles sont inactives. */
  heuresSupActives: boolean;
  semaines: Semaine[];
  semaineCourante: Semaine | null;
  /** Heures supplémentaires du mois en cours. */
  supMois: number;
  totalAnnuel: number;
  supAnnuel: number;
  plafonds: Plafond[];
};

export function construireBilan(
  semaines: Semaine[],
  lundiCourant: string,
  moisCourant: string,
  plafonds: PlafondsFormateur = PLAFONDS_INITIAUX,
): BilanHeures {
  const semaineCourante = semaines.find((s) => s.lundi === lundiCourant) ?? null;

  // Une semaine est rattachée au mois de son lundi : à cheval sur deux mois,
  // elle compte pour celui où elle commence, comme sur une feuille de service.
  const supMois = semaines
    .filter((s) => s.lundi.slice(0, 7) === moisCourant)
    .reduce((t, s) => t + s.supplementaires, 0);

  const totalAnnuel = semaines.reduce((t, s) => t + s.heures, 0);
  const supAnnuel = semaines.reduce((t, s) => t + s.supplementaires, 0);

  const jauges: Plafond[] = [
    evaluer(
      "Masse horaire annuelle",
      totalAnnuel,
      plafonds.heuresAnnuelles,
      `Vous approchez de vos ${plafonds.heuresAnnuelles} h annuelles.`,
      plafonds.heuresSupActives
        ? `Vos ${plafonds.heuresAnnuelles} h annuelles sont dépassées : le surplus relève des heures supplémentaires.`
        : `Vos ${plafonds.heuresAnnuelles} h annuelles sont dépassées.`,
    ),
  ];

  // Sans heures supplémentaires déclarées, leurs deux plafonds n'ont rien à
  // dire : les afficher à zéro n'informerait de rien.
  if (plafonds.heuresSupActives) {
    jauges.push(
      evaluer(
        "Heures supplémentaires ce mois",
        supMois,
        plafonds.plafondSupMensuel,
        `Vous approchez du plafond mensuel de ${plafonds.plafondSupMensuel} h supplémentaires.`,
        `Le plafond mensuel de ${plafonds.plafondSupMensuel} h supplémentaires est dépassé.`,
      ),
      evaluer(
        "Heures supplémentaires sur l'année",
        supAnnuel,
        plafonds.plafondSupAnnuel,
        `Vous approchez du plafond annuel de ${plafonds.plafondSupAnnuel} h supplémentaires.`,
        `Le plafond annuel de ${plafonds.plafondSupAnnuel} h supplémentaires est dépassé.`,
      ),
    );
  }

  return {
    heuresSupActives: plafonds.heuresSupActives,
    semaines,
    semaineCourante,
    supMois: arrondi(supMois),
    totalAnnuel: arrondi(totalAnnuel),
    supAnnuel: arrondi(supAnnuel),
    plafonds: jauges,
  };
}
