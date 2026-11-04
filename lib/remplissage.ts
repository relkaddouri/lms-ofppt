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
 * créneau soit plein, quitte à ce qu'un objectif se scinde sur deux séances.
 *
 * Mais une séance ne porte qu'un objectif et qu'une nature. Une séance qui en
 * mêlait deux ne gardait que l'objectif et la nature du premier : ses heures
 * changeaient d'objectif, et la progression ne retrouvait plus la répartition
 * (DDOUX201, M204 : B.1 à 20 h pour 17 h 30, C.1 à 10 h pour 12 h 30 —
 * signalé le 04/11/2026). Deux objectifs dans un même créneau y font donc
 * deux séances, comme deux modules : le créneau reste entièrement occupé.
 */

export type BlocContenu = {
  /** La séance non datée qui portait ce bloc avant remplissage. */
  seanceId: string;
  /**
   * Le module du bloc. Deux modules ne partagent jamais une séance : quand
   * l'un finit au milieu d'un créneau, le suivant y ouvre la sienne.
   */
  moduleId: string;
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

const enMinutes = (h: string) => {
  const [a, b] = h.split(":");
  return Number(a) * 60 + Number(b);
};

/** « 13:30:00 » plus 2,5 h donne « 16:00:00 ». */
export function ajouterHeures(heure: string, heures: number): string {
  const total = enMinutes(heure) + Math.round(heures * 60);
  const hh = String(Math.floor(total / 60) % 24).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}:00`;
}

/**
 * Les parties libres d'un créneau, une fois retirées les séances qui
 * l'occupent déjà.
 *
 * Un créneau n'était « libre » ou « pris » qu'en entier, à son heure de début.
 * Depuis qu'un module peut finir au milieu d'un créneau et le suivant y
 * commencer, une séance faite de 13 h 30 à 16 h 00 ne prend que la première
 * moitié : la seconde, 16 h 00 – 18 h 30, reste à remplir. La traiter comme
 * prise la faisait disparaître au recalcul suivant.
 */
export function plagesLibres(
  creneau: { debut: string; fin: string },
  occupees: { debut: string; fin: string }[],
): { debut: string; fin: string; duree: number }[] {
  const debut = enMinutes(creneau.debut);
  const fin = enMinutes(creneau.fin);
  const prises = occupees
    .map((o) => [Math.max(debut, enMinutes(o.debut)), Math.min(fin, enMinutes(o.fin))] as const)
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);

  const libres: { debut: string; fin: string; duree: number }[] = [];
  let curseur = debut;
  for (const [a, b] of prises) {
    if (a > curseur) libres.push(plage(curseur, a));
    curseur = Math.max(curseur, b);
  }
  if (fin > curseur) libres.push(plage(curseur, fin));
  return libres;
}

function plage(a: number, b: number) {
  const hhmm = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:00`;
  return { debut: hhmm(a), fin: hhmm(b), duree: net((b - a) / 60) };
}

/** La clé d'un objectif dans un module. */
export function cleObjectif(moduleId: string, suggestionId: string): string {
  return `${moduleId}|${suggestionId}`;
}

/**
 * Ramène le contenu de chaque module à ce que sa répartition lui accorde.
 *
 * Un module a un budget : sa répartition horaire — la masse allouée moins les
 * dix heures d'évaluation. Ce qui est déjà daté (fait, ou passé et resté en
 * place) en consomme une part ; le contenu à placer ne peut dépasser le reste.
 * Sans ce plafond, des recalculs successifs avaient porté M202 à 82 h 30 pour
 * 80 h de répartition.
 *
 * L'excédent se retire d'abord dans l'objectif qui dépasse sa propre part.
 * Retiré en fin de module, il emportait le dernier objectif, qui n'y était
 * pour rien : le recalcul du 04/11/2026 a supprimé les 10 h de C.2 de M204
 * alors que c'était A.1 qui débordait. La fin du module ne cède plus que pour
 * un contenu sans objectif.
 *
 * Rend les blocs plafonnés, et pour chaque ligne touchée la durée retirée.
 */
export function plafonnerParModule(
  blocs: BlocContenu[],
  disponible: ReadonlyMap<string, number>,
  /** Par `cleObjectif(module, objectif)` : la part restante de chaque objectif. */
  disponibleObjectif: ReadonlyMap<string, number> = new Map(),
): { blocs: BlocContenu[]; retraits: { seanceId: string; retire: number; entier: boolean }[] } {
  const restant = new Map(disponible);
  const restantObjectif = new Map(disponibleObjectif);
  const retraits: { seanceId: string; retire: number; entier: boolean }[] = [];
  const garde: BlocContenu[] = [];

  // Dans l'ordre : le début de chaque objectif garde sa place, c'est sa fin
  // qui cède.
  for (const b of blocs) {
    const plafond = restant.get(b.moduleId);
    if (plafond === undefined) {
      garde.push(b);
      continue;
    }
    const cle = b.suggestionId ? cleObjectif(b.moduleId, b.suggestionId) : null;
    const plafondObjectif = cle ? restantObjectif.get(cle) : undefined;
    const pris = net(
      Math.min(
        b.duree,
        Math.max(0, plafond),
        plafondObjectif === undefined ? Infinity : Math.max(0, plafondObjectif),
      ),
    );
    restant.set(b.moduleId, net(plafond - pris));
    if (cle && plafondObjectif !== undefined) {
      restantObjectif.set(cle, net(plafondObjectif - pris));
    }
    if (pris < b.duree) {
      retraits.push({ seanceId: b.seanceId, retire: net(b.duree - pris), entier: pris <= 0 });
    }
    if (pris > 0) garde.push({ ...b, duree: pris });
  }
  return { blocs: garde, retraits };
}

/**
 * Consomme la séquence de blocs pour remplir les créneaux, dans l'ordre.
 *
 * Un bloc plus court que l'espace restant ne clôt pas le créneau : le suivant
 * vient le compléter — dans la même séance s'il a le même objectif et la même
 * nature, dans une séance à lui sinon. Un bloc plus long se scinde, son reste
 * ouvrant le créneau suivant.
 *
 * Le dernier créneau peut rester partiel quand le contenu s'épuise avant lui :
 * c'est une fin de module, pas un trou. Il est signalé comme tel plutôt que
 * comblé avec du contenu qui n'existe pas.
 */
/** Deux blocs peuvent partager une séance : même module, objectif et nature. */
function memeSeance(a: BlocContenu, b: BlocContenu): boolean {
  return (
    a.moduleId === b.moduleId &&
    a.suggestionId === b.suggestionId &&
    a.nature === b.nature
  );
}

export function remplirCreneaux(
  blocs: BlocContenu[],
  creneaux: CreneauCible[],
): Remplissage {
  // Copie de travail : on entame les blocs sans toucher à l'entrée.
  const file = blocs.filter((b) => b.duree > 0).map((b) => ({ ...b }));
  const seances: SeanceRemplie[] = [];
  let i = 0;

  for (const entier of creneaux) {
    // Un créneau peut porter deux séances : la fin d'un objectif, puis le
    // début du suivant, chacune avec ses propres heures.
    let creneau = entier;
    while (i < file.length) {
      let reste = creneau.duree;
      const morceaux: Morceau[] = [];
      let premier: BlocContenu | null = null;

      while (reste > 0 && i < file.length) {
        const bloc = file[i];
        // Un autre module, un autre objectif ou une autre nature ne se glisse
        // pas dans la séance en cours : il ouvrira la sienne dans ce qui reste
        // du créneau.
        if (premier !== null && !memeSeance(premier, bloc)) break;
        premier ??= bloc;
        const pris = Math.min(bloc.duree, reste);
        morceaux.push({ bloc: { ...bloc }, duree: pris });
        bloc.duree = net(bloc.duree - pris);
        reste = net(reste - pris);
        if (bloc.duree <= 0) i += 1;
      }

      if (morceaux.length === 0) break;
      const utilise = net(creneau.duree - reste);
      // Une séance partielle s'arrête quand son contenu s'arrête : 13 h 30 –
      // 16 h 00 pour 2 h 30, et non 13 h 30 – 18 h 30 avec 2 h 30 de vide.
      const finSeance = reste > 0 ? ajouterHeures(creneau.debut, utilise) : creneau.fin;
      seances.push({
        creneau: { ...creneau, fin: finSeance, duree: utilise },
        morceaux,
        partiel: reste > 0,
      });
      if (reste <= 0) break;
      creneau = { date: creneau.date, debut: finSeance, fin: creneau.fin, duree: reste };
    }
    if (i >= file.length) break;
  }

  return {
    seances,
    heuresRestantes: net(file.slice(i).reduce((s, b) => s + b.duree, 0)),
  };
}

// ── Ce que le recalcul a le droit de toucher (PRD §4.9) ─────────────────────

/** Un instant repéré à l'établissement : `YYYY-MM-DD` et `HH:MM`. */
export type Instant = { date: string; heure: string };

/** « 08:30:00 » et « 08:30 » désignent la même heure. */
const hm = (h: string) => h.slice(0, 5);

/**
 * Vrai si le recalcul peut détacher cette séance « à faire » de sa date.
 *
 * Une séance dont l'heure est passée reste où elle est, cochée ou non. Le
 * formateur coche souvent le lendemain : la séance de mardi matin, pas encore
 * marquée faite le mercredi, n'en a pas moins eu lieu. La traiter comme une
 * prévision la renvoyait après aujourd'hui, et son créneau — passé — ne
 * pouvait plus rien recevoir : elle disparaissait du mardi.
 *
 * Elle reste aussi où elle est si elle précède le point de départ du
 * recalcul, pour la même raison : ce qu'on détache doit pouvoir être replacé.
 */
export function seanceDeplacable(
  seance: { date: string; heure_debut: string | null },
  depart: string,
  instant: Instant,
): boolean {
  if (seance.date < depart || seance.date < instant.date) return false;
  if (seance.date > instant.date) return true;
  // Aujourd'hui : seulement si elle n'a pas commencé. Sans heure connue, on
  // ne prend pas le risque de déplacer une séance en cours.
  return seance.heure_debut !== null && hm(seance.heure_debut) > instant.heure;
}

/**
 * Vrai si un créneau du motif peut recevoir une séance.
 *
 * Deux refus. Le créneau est déjà pris — par une séance faite, ou par une
 * séance passée restée en place : y écrire en créerait une seconde à la même
 * heure. Ou, lors d'un recalcul, il a déjà commencé : un recalcul ne planifie
 * pas dans le passé.
 */
export function creneauOuvert(
  creneau: { date: string; debut: string },
  occupes: ReadonlySet<string>,
  /**
   * Le présent, quand c'est un recalcul. Absent pour une génération lancée à
   * la main à partir d'une date choisie : le formateur qui la fait partir
   * d'une date passée veut précisément remplir ces semaines-là.
   */
  instant?: Instant,
): boolean {
  if (occupes.has(cleCreneau(creneau.date, creneau.debut))) return false;
  if (!instant) return true;
  if (creneau.date < instant.date) return false;
  if (creneau.date === instant.date && hm(creneau.debut) <= instant.heure) {
    return false;
  }
  return true;
}

/** La clé d'un créneau occupé : un jour et une heure de début. */
export function cleCreneau(date: string, debut: string): string {
  return `${date}|${hm(debut)}`;
}

/**
 * La ligne de séance qui porte une séance remplie.
 *
 * Le remplissage peut fondre plusieurs anciennes séances en une seule ; les
 * lignes absorbées sont ensuite supprimées, et avec elles tout ce qui s'y
 * rattache — fiche, support, appel, remarques. Une séance déjà préparée doit
 * donc porter la séance où elle tombe, plutôt que d'y être absorbée.
 *
 * Rend `null` quand aucune ligne n'est libre : la séance ouvrira une ligne
 * neuve.
 */
export function choisirPorteur(
  idsDesMorceaux: string[],
  revendiquees: ReadonlySet<string>,
  preparees: ReadonlySet<string>,
): string | null {
  const libres = idsDesMorceaux.filter((id) => !revendiquees.has(id));
  return libres.find((id) => preparees.has(id)) ?? libres[0] ?? null;
}

// ── L'intitulé d'une séance ─────────────────────────────────────────────────

/** Une nature écrite en fin de segment : « — theorique », « — pratique ». */
const NATURE = / — (th[ée]orique|pratique)/;

/**
 * Remet d'aplomb un intitulé de séance.
 *
 * Chaque recalcul recomposait l'intitulé à partir de l'intitulé précédent, en
 * y ajoutant la nature : « A.1 — Réaliser un travail de recherche — theorique
 * — theorique — theorique… », une nature de plus à chaque passage, et les
 * séances fusionnées recopiant les segments de leurs voisines jusqu'à 853
 * caractères.
 *
 * Un segment garde sa **première** nature : c'est celle qu'il portait quand la
 * séance a été composée ; les suivantes ont été ajoutées par les recalculs,
 * avec la nature de la ligne qui le portait, pas la sienne. Les segments
 * identiques ne sont écrits qu'une fois.
 */
export function normaliserIntitule(intitule: string): string {
  const segments = intitule
    .split(" · ")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((segment) => {
      const trouve = NATURE.exec(segment);
      if (!trouve) return segment;
      // Tout ce qui suit la première nature n'est que répétition de natures.
      const fin = trouve.index + trouve[0].length;
      const reste = segment.slice(fin);
      return /^( — (th[ée]orique|pratique))*$/.test(reste)
        ? segment.slice(0, fin)
        : segment;
    });
  return [...new Set(segments)].join(" · ");
}

/**
 * L'intitulé d'une séance remplie, à partir des morceaux qu'elle porte.
 *
 * Idempotent : recalculer dix fois un planning inchangé écrit dix fois le même
 * intitulé. Un segment qui porte déjà sa nature la garde ; un segment qui
 * n'en a pas reçoit celle du bloc.
 */
export function composerIntitule(
  morceaux: { code: string; nature: "theorique" | "pratique" | null }[],
): string | null {
  const segments = morceaux.flatMap(({ code, nature }) =>
    normaliserIntitule(code)
      .split(" · ")
      .filter(Boolean)
      .map((segment) =>
        NATURE.test(segment) || !nature ? segment : `${segment} — ${nature}`,
      ),
  );
  const uniques = [...new Set(segments)];
  return uniques.length > 0 ? uniques.join(" · ") : null;
}
