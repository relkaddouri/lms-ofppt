/**
 * Créneaux horaires standards de la journée (PRD §4.10).
 *
 * Un bloc de demi-journée fait environ 5 h avec une pause interne de 15 min.
 * Ce n'est pas un découpage imposé : selon l'emploi du temps réel, un bloc peut
 * rester d'un seul tenant ou être scindé en deux séances d'environ 2 h 15,
 * sur deux modules ou deux groupes différents.
 */

export type BlocHoraire = "matin" | "soir";
/** `complet` garde le bloc entier ; `premier`/`second` le scindent en deux. */
export type PartieBloc = "complet" | "premier" | "second";

export type Creneau = { debut: string; fin: string };

export const BLOCS: Record<
  BlocHoraire,
  { label: string; debut: string; fin: string; pause: Creneau }
> = {
  matin: {
    label: "Matin",
    debut: "08:30",
    fin: "13:30",
    pause: { debut: "10:45", fin: "11:00" },
  },
  soir: {
    label: "Soir",
    debut: "13:30",
    fin: "18:30",
    pause: { debut: "15:45", fin: "16:00" },
  },
};

export const PARTIES: { valeur: PartieBloc; label: string }[] = [
  { valeur: "complet", label: "Bloc entier (~5 h)" },
  { valeur: "premier", label: "1re moitié (~2 h 15)" },
  { valeur: "second", label: "2de moitié (~2 h 15)" },
];

const enMinutes = (h: string) => {
  const [hh, mm] = h.split(":").map(Number);
  return hh * 60 + mm;
};

/**
 * Horaires d'une séance à partir d'un bloc et d'une éventuelle scission.
 * La scission tombe sur la pause interne : c'est la coupure naturelle du bloc.
 */
export function creneauDe(bloc: BlocHoraire, partie: PartieBloc): Creneau {
  const b = BLOCS[bloc];
  if (partie === "premier") return { debut: b.debut, fin: b.pause.debut };
  if (partie === "second") return { debut: b.pause.fin, fin: b.fin };
  return { debut: b.debut, fin: b.fin };
}

/** Durée en heures entre deux horaires, arrondie au quart d'heure. */
export function dureeHeures(debut: string, fin: string): number {
  const minutes = enMinutes(fin) - enMinutes(debut);
  return Math.round((minutes / 60) * 4) / 4;
}

/** `08:30` → `8 h 30`, `13:00` → `13 h`. Affichage français. */
export function formatHeure(valeur: string | null | undefined): string {
  if (!valeur) return "—";
  const [hh, mm] = valeur.slice(0, 5).split(":");
  return mm === "00" ? `${Number(hh)} h` : `${Number(hh)} h ${mm}`;
}

/**
 * L'heure de fin d'une épreuve : son début plus sa durée.
 *
 * Elle ne se stocke nulle part — la stocker, c'est se donner deux vérités qui
 * finissent par se contredire quand la durée change.
 */
export function finEpreuve(debut: string, heures: number): string {
  const [hh, mm] = debut.slice(0, 5).split(":").map(Number);
  const total = (hh ?? 0) * 60 + (mm ?? 0) + Math.round(heures * 60);
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(
    total % 60,
  ).padStart(2, "0")}`;
}

/** « 2 h 30 » à partir de 2,5 — la durée telle qu'elle se dit. */
export function dureeEnTexte(heures: number): string {
  const h = Math.floor(heures);
  const m = Math.round((heures - h) * 60);
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

/**
 * Les quatre créneaux fixes de la grille calendrier (PRD §4.10).
 *
 * Base commune à toute la semaine, en blocs de 2 h 30 : c'est la granularité
 * réelle des créneaux déclarés dans le motif hebdomadaire. Les deux blocs
 * « Matin » et « Soir » de 5 h qui les remplaçaient ne pouvaient pas
 * représenter un vendredi scindé entre deux groupes.
 */
export const CRENEAUX_JOUR = [
  { debut: "08:30", fin: "11:00" },
  { debut: "11:00", fin: "13:30" },
  { debut: "13:30", fin: "16:00" },
  { debut: "16:00", fin: "18:30" },
] as const;

/** Minutes depuis minuit, pour « HH:MM » comme pour « HH:MM:SS ». */
function minutes(h: string): number {
  const [a, b] = h.split(":");
  return Number(a) * 60 + Number(b);
}

export type Position = {
  /** Index du premier créneau occupé, 0 à 3. */
  index: number;
  /** Nombre de créneaux couverts — 2 pour une séance de 5 h. */
  span: number;
};

/**
 * Place une séance sur la grille des quatre créneaux.
 *
 * Renvoie `null` quand les horaires ne s'alignent sur aucun créneau — une
 * séance de 1 h, ou commençant à 9 h 15. Le cas ne se produit pas avec les
 * séances générées, toutes calées sur des multiples de 2 h 30, mais une
 * séance saisie à la main peut sortir de la grille : mieux vaut le signaler
 * que de l'y forcer et afficher une durée fausse.
 */
export function positionSeance(
  debut: string | null,
  fin: string | null,
): Position | null {
  if (!debut) return null;

  const d = minutes(debut);
  const f = fin ? minutes(fin) : d + 150;

  const index = CRENEAUX_JOUR.findIndex((c) => minutes(c.debut) === d);
  if (index < 0) return null;

  const dernier = CRENEAUX_JOUR.findIndex((c) => minutes(c.fin) === f);
  if (dernier < index) return null;

  return { index, span: dernier - index + 1 };
}
