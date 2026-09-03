/**
 * Répartition d'une masse horaire sur les objectifs d'apprentissage.
 *
 * Fonctions pures, hors serveur : elles sont testables seules et réutilisables
 * par l'aperçu côté navigateur sans refaire un aller-retour.
 */

export type ObjectifARepartir = {
  id: string;
  code: string;
  intitule: string;
  lettre: string;
  /** Part de l'élément dans le module, portée par son premier objectif. */
  pourcentElement: number | null;
};

export type PartHoraire = {
  suggestion_pedagogique_id: string;
  heures_theoriques: number;
  heures_pratiques: number;
};

/**
 * Le grain de toute durée : 2 h 30.
 *
 * C'est le plus petit bloc qu'un emploi du temps sait placer (§4.9) : les
 * créneaux se déclarent en blocs de 2 h 30 ou de 5 h. Une valeur comme 6 h 30
 * ne correspond à aucun découpage réel — elle oblige le formateur à
 * rearbitrer à la main ce que la répartition prétendait avoir décidé.
 */
export const PAS = 2.5;

/**
 * Le temps d'évaluation, réservé avant toute répartition.
 *
 * Deux contrôles continus et une épreuve de fin de module sont obligatoires
 * (PRD §4.7) : leurs heures ne sont pas disponibles pour les apprentissages.
 * Elles étaient jusqu'ici déduites en pourcentage — 6 % de la masse — donc
 * variables et invisibles. Elles sont maintenant fixes et affichées ligne à
 * ligne : un formateur doit voir ce qui lui est retiré, pas le déduire d'un
 * total qui ne tombe pas juste.
 */
export const LIGNES_EVALUATION = [
  { cle: "cc1", libelle: "Contrôle continu 1", heures: 2.5 },
  { cle: "cc2", libelle: "Contrôle continu 2", heures: 2.5 },
  { cle: "efm", libelle: "Épreuve de fin de module", heures: 5 },
] as const;

export const HEURES_EVALUATION = LIGNES_EVALUATION.reduce(
  (s, l) => s + l.heures,
  0,
);

/** Arrondi à la demi-heure — conservé pour les saisies libres du formateur. */
export function arrondi(h: number): number {
  return Math.round(h * 2) / 2;
}

/** Arrondi au bloc de 2 h 30 le plus proche. */
export function arrondiPas(h: number): number {
  return Math.round(h / PAS) * PAS;
}

/**
 * Répartit un nombre entier d'unités selon des poids, sans jamais en perdre.
 *
 * Arrondir chaque part indépendamment fait dériver le total : sur quatre
 * éléments, quatre arrondis au bloc supérieur ajoutent jusqu'à 10 heures qui
 * n'existent pas. On distribue donc les unités entières d'abord, puis les
 * restantes aux plus fortes décimales — la somme retombe exactement sur le
 * total demandé, par construction.
 */
export function repartirUnites(total: number, poids: number[]): number[] {
  if (poids.length === 0) return [];
  if (total <= 0) return poids.map(() => 0);

  const somme = poids.reduce((s, p) => s + Math.max(0, p), 0);
  // Sans poids déclaré, les parts sont égales : c'est le seul partage que le
  // référentiel autorise à supposer.
  const effectifs = somme > 0 ? poids.map((p) => Math.max(0, p)) : poids.map(() => 1);
  const base = effectifs.reduce((s, p) => s + p, 0);

  const exactes = effectifs.map((p) => (total * p) / base);
  const parts = exactes.map((v) => Math.floor(v));
  let reste = total - parts.reduce((s, v) => s + v, 0);

  const ordre = exactes
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);

  for (const { i } of ordre) {
    if (reste <= 0) break;
    parts[i] += 1;
    reste -= 1;
  }
  return parts;
}

export type Proposition = {
  parts: PartHoraire[];
  heuresEvaluation: number;
  /**
   * Ce qui ne tient dans aucun bloc de 2 h 30 — nul si la masse horaire est
   * elle-même un multiple du pas. Renvoyé plutôt que réparti en silence : ces
   * heures existent sur le papier et ne se placeront nulle part.
   */
  heuresNonPlacables: number;
};

/**
 * Propose une répartition à partir de la masse horaire allouée.
 *
 * Trois niveaux, chacun exact par construction :
 *   1. l'évaluation est réservée — dix heures fixes, jamais un pourcentage ;
 *   2. le reste se partage entre éléments selon les pourcentages du
 *      référentiel, en blocs de 2 h 30 ;
 *   3. dans un élément, les objectifs se partagent également, et chaque
 *      objectif se partage entre théorique et pratique selon les proportions
 *      de la compétence.
 *
 * À chaque niveau, la somme des parts est exactement le total du niveau
 * au-dessus : le total général retombe donc sur la masse horaire, sans écart
 * à rattraper après coup.
 */
export function proposerRepartition(
  objectifs: ObjectifARepartir[],
  masseHoraire: number,
  pctTheorique = 60,
  pctPratique = 34,
): Proposition {
  const heuresEvaluation = Math.min(HEURES_EVALUATION, Math.max(0, masseHoraire));
  const disponible = Math.max(0, masseHoraire - heuresEvaluation);
  const unites = Math.floor(disponible / PAS + 1e-9);
  const heuresNonPlacables = arrondi(disponible - unites * PAS);

  // Regrouper par élément, en conservant l'ordre d'apparition.
  const elements = new Map<string, ObjectifARepartir[]>();
  for (const o of objectifs) {
    const liste = elements.get(o.lettre) ?? [];
    liste.push(o);
    elements.set(o.lettre, liste);
  }

  const lettres = [...elements.keys()];
  // La part d'un élément est portée par son premier objectif à la déclarer.
  const poids = lettres.map(
    (l) => elements.get(l)!.find((o) => o.pourcentElement != null)?.pourcentElement ?? 0,
  );

  const unitesParElement = repartirUnites(unites, poids);
  const resultat: PartHoraire[] = [];

  lettres.forEach((lettre, i) => {
    const liste = elements.get(lettre)!;
    // Le référentiel ne départage pas les objectifs d'un même élément : ils se
    // partagent également, le reste allant aux premiers.
    const unitesParObjectif = repartirUnites(
      unitesParElement[i],
      liste.map(() => 1),
    );

    liste.forEach((o, j) => {
      const [uT, uP] = repartirUnites(unitesParObjectif[j], [
        pctTheorique,
        pctPratique,
      ]);
      resultat.push({
        suggestion_pedagogique_id: o.id,
        heures_theoriques: uT * PAS,
        heures_pratiques: uP * PAS,
      });
    });
  });

  return { parts: resultat, heuresEvaluation, heuresNonPlacables };
}

export function totalReparti(parts: PartHoraire[]): number {
  return arrondi(
    parts.reduce((s, p) => s + p.heures_theoriques + p.heures_pratiques, 0),
  );
}
