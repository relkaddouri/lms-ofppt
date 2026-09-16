/**
 * La répétition d'un créneau d'emploi du temps (PRD §4.9, migration 087).
 *
 * Un créneau ne revient pas forcément chaque semaine. Un groupe qu'on accélère
 * alterne 25 h et 27 h 30 : un créneau de 2 h 30 ne revient qu'une semaine sur
 * deux. D'autres ne reviennent qu'une fois par mois.
 *
 * Tout est calculé en dates `YYYY-MM-DD` à midi UTC, comme le générateur : pas
 * de fuseau, pas de changement d'heure qui ferait glisser une semaine.
 */

export type Recurrence = "hebdomadaire" | "une_semaine_sur_deux" | "mensuelle";

export const RECURRENCES: {
  valeur: Recurrence;
  libelle: string;
  court: string;
}[] = [
  { valeur: "hebdomadaire", libelle: "Chaque semaine", court: "" },
  {
    valeur: "une_semaine_sur_deux",
    libelle: "Une semaine sur deux",
    court: "1 sem. sur 2",
  },
  { valeur: "mensuelle", libelle: "Une fois par mois", court: "1× par mois" },
];

export type CreneauRecurrent = {
  jour_semaine: number;
  heure_debut: string;
  heure_fin: string;
  recurrence: Recurrence;
  premiere_date: string | null;
};

const JOUR_MS = 86_400_000;

const aMidi = (iso: string) => new Date(`${iso}T12:00:00Z`);

/** Le lundi de la semaine d'une date, en nombre de jours depuis l'époque. */
function lundi(iso: string): number {
  const d = aMidi(iso);
  const decalage = (d.getUTCDay() + 6) % 7; // lundi = 0
  return Math.round(d.getTime() / JOUR_MS) - decalage;
}

/** Le rang d'une date parmi les mêmes jours de son mois : 1 pour le premier mardi. */
export function rangDansLeMois(iso: string): number {
  return Math.ceil(aMidi(iso).getUTCDate() / 7);
}

/**
 * Vrai si le créneau a lieu ce jour-là.
 *
 * Le jour de la semaine est supposé déjà vérifié par l'appelant — le
 * générateur parcourt les jours et ne consulte que les créneaux du bon jour.
 * On le revérifie tout de même : une fonction qui répond « oui » un mercredi
 * pour un créneau du mardi finirait par servir ailleurs.
 */
export function creneauALieu(creneau: CreneauRecurrent, iso: string): boolean {
  const d = aMidi(iso);
  const isodow = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  if (isodow !== creneau.jour_semaine) return false;

  if (creneau.recurrence === "hebdomadaire" || !creneau.premiere_date) {
    return true;
  }

  if (creneau.recurrence === "une_semaine_sur_deux") {
    const ecart = (lundi(iso) - lundi(creneau.premiere_date)) / 7;
    // Les deux sens : un créneau déclaré en novembre connaît aussi ses
    // semaines d'octobre.
    return Math.abs(ecart) % 2 === 0;
  }

  // Une fois par mois : le même rang du jour que la première occurrence.
  return rangDansLeMois(iso) === rangDansLeMois(creneau.premiere_date);
}

/**
 * La prochaine date, à partir d'aujourd'hui inclus, qui tombe tel jour.
 *
 * Sert de valeur proposée pour « Première fois le » : un formateur qui choisit
 * « mardi, une semaine sur deux » veut le plus souvent commencer ce mardi-ci
 * ou le prochain, pas saisir une date de zéro.
 */
export function prochaineDate(jourSemaine: number, aPartirDe: string): string {
  const d = aMidi(aPartirDe);
  const isodow = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + ((jourSemaine - isodow + 7) % 7));
  return d.toISOString().slice(0, 10);
}

/** Durée d'un créneau en heures. */
function duree(debut: string, fin: string): number {
  const m = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
  return Math.max(0, (m(fin) - m(debut)) / 60);
}

/**
 * Les heures par semaine, de la plus légère à la plus chargée.
 *
 * Calculées sur un an de semaines réelles plutôt que déduites des rythmes :
 * un créneau mensuel et un créneau une semaine sur deux se croisent selon le
 * calendrier, et c'est ce croisement que le formateur vit.
 */
export function heuresParSemaine(
  creneaux: CreneauRecurrent[],
  aPartirDe: string,
): { min: number; max: number } {
  if (creneaux.length === 0) return { min: 0, max: 0 };
  const debut = aMidi(aPartirDe);
  debut.setUTCDate(debut.getUTCDate() - ((debut.getUTCDay() + 6) % 7));

  let min = Infinity;
  let max = 0;
  for (let semaine = 0; semaine < 52; semaine++) {
    let total = 0;
    for (let jour = 0; jour < 7; jour++) {
      const d = new Date(debut);
      d.setUTCDate(d.getUTCDate() + semaine * 7 + jour);
      const iso = d.toISOString().slice(0, 10);
      for (const c of creneaux) {
        if (creneauALieu(c, iso)) total += duree(c.heure_debut, c.heure_fin);
      }
    }
    min = Math.min(min, total);
    max = Math.max(max, total);
  }
  return { min, max };
}

/** La mention courte d'un rythme — « 1 sem. sur 2 » —, vide pour un créneau hebdomadaire. */
export function libelleRecurrence(
  c: Pick<CreneauRecurrent, "recurrence" | "premiere_date">,
): string {
  return RECURRENCES.find((r) => r.valeur === c.recurrence)?.court ?? "";
}
