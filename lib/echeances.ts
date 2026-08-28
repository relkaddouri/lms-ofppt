/**
 * Échéances réglementaires attachées à un contrôle (PRD §4.11).
 *
 * Quatre délais, de deux natures différentes. Trois se comptent en jours autour
 * de l'épreuve. Le quatrième — la restitution des notes d'un contrôle continu —
 * se compte en séances : « la deuxième séance suivante » n'a pas de traduction
 * en jours tant que le calendrier du groupe n'est pas posé.
 */

export const DELAI_PREPARATION_EFM = 20;
export const DELAI_RESTITUTION_EFM = 10;
export const DELAI_RESULTATS_EFM = 15;
/** Rang de la séance à laquelle les notes d'un contrôle continu se rendent. */
export const SEANCES_RESTITUTION_CC = 2;

/** En deçà, l'échéance est imminente. */
const JOURS_IMMINENT = 3;

export type EtatEcheance = "a_venir" | "imminent" | "depasse" | "inconnu";

export type Echeance = {
  controleId: string;
  controleLibelle: string;
  groupeNom: string;
  libelle: string;
  date: string | null;
  /** Jours restants ; négatif si la date est passée. */
  jours: number | null;
  etat: EtatEcheance;
  detail: string | null;
};

export type ControleEcheance = {
  id: string;
  libelle: string;
  groupeNom: string;
  type: "CC" | "EFM";
  /** Date retenue : l'administration effective, sinon la date prévue. */
  date: string | null;
};

const MS_JOUR = 86_400_000;

function ajoute(date: string, jours: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
}

function ecart(date: string, aujourdhui: string): number {
  return Math.round(
    (new Date(`${date}T12:00:00Z`).getTime() -
      new Date(`${aujourdhui}T12:00:00Z`).getTime()) /
      MS_JOUR,
  );
}

function etatDe(jours: number): EtatEcheance {
  if (jours < 0) return "depasse";
  return jours <= JOURS_IMMINENT ? "imminent" : "a_venir";
}

/**
 * Échéances d'un contrôle.
 *
 * `seancesApres` liste les dates des séances du couple groupe + module
 * postérieures au contrôle, dans l'ordre : c'est la seule façon de dater « la
 * deuxième séance suivante ».
 */
export function echeancesDe(
  controle: ControleEcheance,
  seancesApres: string[],
  aujourdhui: string,
): Echeance[] {
  const base = {
    controleId: controle.id,
    controleLibelle: controle.libelle,
    groupeNom: controle.groupeNom,
  };

  if (!controle.date) {
    return [
      {
        ...base,
        libelle: controle.type === "EFM" ? "Épreuve à dater" : "Contrôle à dater",
        date: null,
        jours: null,
        etat: "inconnu",
        detail: "Aucune date n'est posée : les échéances ne peuvent pas être calculées.",
      },
    ];
  }

  if (controle.type === "CC") {
    const cible = seancesApres[SEANCES_RESTITUTION_CC - 1] ?? null;
    if (!cible) {
      return [
        {
          ...base,
          libelle: "Restitution des notes",
          date: null,
          jours: null,
          etat: "inconnu",
          detail: `Moins de ${SEANCES_RESTITUTION_CC} séances sont planifiées après le contrôle : l'échéance se datera quand elles le seront.`,
        },
      ];
    }
    const jours = ecart(cible, aujourdhui);
    return [
      {
        ...base,
        libelle: "Restitution des notes",
        date: cible,
        jours,
        etat: etatDe(jours),
        detail: `Deuxième séance suivant le contrôle du ${controle.date}.`,
      },
    ];
  }

  return [
    {
      libelle: "Préparation de l'épreuve",
      date: ajoute(controle.date, -DELAI_PREPARATION_EFM),
      detail: `${DELAI_PREPARATION_EFM} jours avant l'épreuve, pour validation en commission.`,
    },
    {
      libelle: "Restitution des copies",
      date: ajoute(controle.date, DELAI_RESTITUTION_EFM),
      detail: `${DELAI_RESTITUTION_EFM} jours après l'épreuve.`,
    },
    {
      libelle: "Affichage des résultats",
      date: ajoute(controle.date, DELAI_RESULTATS_EFM),
      detail: `${DELAI_RESULTATS_EFM} jours après l'épreuve.`,
    },
  ].map((e) => {
    const jours = ecart(e.date, aujourdhui);
    return { ...base, ...e, jours, etat: etatDe(jours) };
  });
}

/** Les échéances dépassées et imminentes d'abord : ce sont elles qui pressent. */
export function trierEcheances(liste: Echeance[]): Echeance[] {
  const rang: Record<EtatEcheance, number> = {
    depasse: 0,
    imminent: 1,
    a_venir: 2,
    inconnu: 3,
  };
  return [...liste].sort(
    (a, b) => rang[a.etat] - rang[b.etat] || (a.jours ?? 0) - (b.jours ?? 0),
  );
}
