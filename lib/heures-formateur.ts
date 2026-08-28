/**
 * Suivi cumulatif des heures dispensées (PRD §4.10).
 *
 * Trois plafonds, de nature différente : la masse légale annuelle, qui ne se
 * dépasse qu'en heures supplémentaires ; le plafond mensuel de ces heures
 * supplémentaires ; leur plafond annuel. Les trois se surveillent ensemble —
 * rester sous l'un ne dit rien des deux autres.
 */

/** Masse horaire légale annuelle, en heures. */
export const PLAFOND_ANNUEL = 910;
/** Heures supplémentaires : plafond mensuel. */
export const PLAFOND_SUP_MENSUEL = 30;
/** Heures supplémentaires : plafond annuel. */
export const PLAFOND_SUP_ANNUEL = 260;

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
): BilanHeures {
  const semaineCourante = semaines.find((s) => s.lundi === lundiCourant) ?? null;

  // Une semaine est rattachée au mois de son lundi : à cheval sur deux mois,
  // elle compte pour celui où elle commence, comme sur une feuille de service.
  const supMois = semaines
    .filter((s) => s.lundi.slice(0, 7) === moisCourant)
    .reduce((t, s) => t + s.supplementaires, 0);

  const totalAnnuel = semaines.reduce((t, s) => t + s.heures, 0);
  const supAnnuel = semaines.reduce((t, s) => t + s.supplementaires, 0);

  const plafonds: Plafond[] = [
    evaluer(
      "Masse horaire annuelle",
      totalAnnuel,
      PLAFOND_ANNUEL,
      `Vous approchez des ${PLAFOND_ANNUEL} h légales.`,
      `Les ${PLAFOND_ANNUEL} h légales sont dépassées : le surplus doit être couvert par des heures supplémentaires.`,
    ),
    evaluerSupMensuel(supMois),
    evaluer(
      "Heures supplémentaires sur l'année",
      supAnnuel,
      PLAFOND_SUP_ANNUEL,
      `Vous approchez du plafond annuel de ${PLAFOND_SUP_ANNUEL} h supplémentaires.`,
      `Le plafond annuel de ${PLAFOND_SUP_ANNUEL} h supplémentaires est dépassé.`,
    ),
  ];

  return {
    semaines,
    semaineCourante,
    supMois: arrondi(supMois),
    totalAnnuel: arrondi(totalAnnuel),
    supAnnuel: arrondi(supAnnuel),
    plafonds,
  };
}

function evaluerSupMensuel(supMois: number): Plafond {
  return evaluer(
    "Heures supplémentaires ce mois",
    supMois,
    PLAFOND_SUP_MENSUEL,
    `Vous approchez du plafond mensuel de ${PLAFOND_SUP_MENSUEL} h supplémentaires.`,
    `Le plafond mensuel de ${PLAFOND_SUP_MENSUEL} h supplémentaires est dépassé.`,
  );
}
