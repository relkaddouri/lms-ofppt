/**
 * Remplissage des créneaux d'un motif hebdomadaire (PRD §4.9).
 *
 * Règle non négociable : un créneau est **entièrement occupé** ou il ne l'est
 * pas. Ce n'est pas de l'esthétique — le formateur déclare sur E-note les
 * heures réellement travaillées par semaine et par module. Une séance de 2 h 30
 * posée dans un créneau de 5 h laisse 2 h 30 qui n'existent nulle part : ni
 * dans l'application, ni dans la déclaration.
 *
 * L'algorithme ne raisonne donc plus par objectif — « à chaque bloc sa
 * séance », ce qui laissait le créneau se remplir par accident — mais par
 * créneau à remplir : la séquence pédagogique est consommée jusqu'à ce que le
 * créneau soit plein, quitte à ce qu'une séance porte deux objectifs, ou qu'un
 * objectif se scinde sur deux séances.
 */

export type BlocContenu = {
  /** La séance non datée qui portait ce bloc avant remplissage. */
  seanceId: string;
  suggestionId: string | null;
  code: string;
  nature: "theorique" | "pratique" | null;
  duree: number;
};

export type CreneauCible = {
  date: string;
  debut: string;
  fin: string;
  duree: number;
};

export type Morceau = { bloc: BlocContenu; duree: number };

export type SeanceRemplie = {
  creneau: CreneauCible;
  morceaux: Morceau[];
  /** Vrai si le contenu s'est épuisé avant que le créneau soit plein. */
  partiel: boolean;
};

export type Remplissage = {
  seances: SeanceRemplie[];
  /** Heures de contenu qui n'ont trouvé aucun créneau. */
  heuresRestantes: number;
};

/** Durée d'un créneau en heures, à partir de deux « HH:MM[:SS] ». */
export function dureeCreneau(debut: string, fin: string): number {
  const minutes = (h: string) => {
    const [a, b] = h.split(":");
    return Number(a) * 60 + Number(b);
  };
  return Math.max(0, (minutes(fin) - minutes(debut)) / 60);
}

/** Les flottants de durée s'accumulent : on recale au centième. */
const net = (v: number) => Number(v.toFixed(2));

/**
 * Consomme la séquence de blocs pour remplir les créneaux, dans l'ordre.
 *
 * Un bloc plus court que l'espace restant ne clôt pas le créneau : le suivant
 * vient compléter la même séance, fût-il d'un autre objectif ou d'un autre
 * élément. Un bloc plus long se scinde, son reste ouvrant le créneau suivant.
 *
 * Le dernier créneau peut rester partiel quand le contenu s'épuise avant lui :
 * c'est une fin de module, pas un trou. Il est signalé comme tel plutôt que
 * comblé avec du contenu qui n'existe pas.
 */
export function remplirCreneaux(
  blocs: BlocContenu[],
  creneaux: CreneauCible[],
): Remplissage {
  // Copie de travail : on entame les blocs sans toucher à l'entrée.
  const file = blocs.filter((b) => b.duree > 0).map((b) => ({ ...b }));
  const seances: SeanceRemplie[] = [];
  let i = 0;

  for (const creneau of creneaux) {
    if (i >= file.length) break;

    let reste = creneau.duree;
    const morceaux: Morceau[] = [];

    while (reste > 0 && i < file.length) {
      const bloc = file[i];
      const pris = Math.min(bloc.duree, reste);
      morceaux.push({ bloc: { ...bloc }, duree: pris });
      bloc.duree = net(bloc.duree - pris);
      reste = net(reste - pris);
      if (bloc.duree <= 0) i += 1;
    }

    if (morceaux.length > 0) {
      seances.push({ creneau, morceaux, partiel: reste > 0 });
    }
  }

  return {
    seances,
    heuresRestantes: net(file.slice(i).reduce((s, b) => s + b.duree, 0)),
  };
}
