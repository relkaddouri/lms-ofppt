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
