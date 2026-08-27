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
 * Arrondi à la demi-heure.
 *
 * Un formateur enseigne par blocs de 2 h 30, 3 h ou 5 h : un quart d'heure
 * n'est pas une unité qu'il peut placer dans un emploi du temps, et « 5,25 h »
 * ne se lit pas. La demi-heure est le plus petit grain réellement utilisable.
 */
export function arrondi(h: number): number {
  return Math.round(h * 2) / 2;
}

/**
 * Propose une répartition à partir de la masse horaire allouée.
 *
 * Trois règles, dans cet ordre :
 *   1. la part d'évaluation est mise de côté — elle finance les contrôles, pas
 *      les apprentissages ;
 *   2. le reste se partage entre éléments selon les pourcentages du
 *      référentiel (A 15 %, B 30 %, C 15 %, D 40 % sur la compétence 6) ;
 *   3. à l'intérieur d'un élément, les objectifs se partagent à parts égales —
 *      le référentiel ne les départage pas, et le formateur ajustera.
 */
export function proposerRepartition(
  objectifs: ObjectifARepartir[],
  masseHoraire: number,
  pctTheorique = 60,
  pctPratique = 34,
  pctEvaluation = 6,
): { parts: PartHoraire[]; heuresEvaluation: number } {
  const heuresEvaluation = arrondi((masseHoraire * pctEvaluation) / 100);
  const aRepartir = masseHoraire - heuresEvaluation;

  // Regrouper par élément, en conservant l'ordre d'apparition.
  const elements = new Map<string, ObjectifARepartir[]>();
  for (const o of objectifs) {
    const liste = elements.get(o.lettre) ?? [];
    liste.push(o);
    elements.set(o.lettre, liste);
  }

  // La part d'un élément est portée par son premier objectif. Si le
  // référentiel ne la donne pas, les éléments se partagent également.
  const parts: { lettre: string; pct: number }[] = [];
  for (const [lettre, liste] of elements) {
    const declare = liste.find((o) => o.pourcentElement != null)?.pourcentElement;
    parts.push({ lettre, pct: declare ?? 0 });
  }
  const totalDeclare = parts.reduce((s, p) => s + p.pct, 0);
  if (totalDeclare <= 0) {
    for (const p of parts) p.pct = 100 / parts.length;
  }

  const somme = parts.reduce((s, p) => s + p.pct, 0) || 1;
  const resultat: PartHoraire[] = [];

  for (const { lettre, pct } of parts) {
    const liste = elements.get(lettre)!;
    const heuresElement = (aRepartir * pct) / somme;
    const parObjectif = heuresElement / liste.length;
    // Le partage théorique / pratique suit les proportions annoncées, une fois
    // l'évaluation retirée : elles ne totalisent plus 100 à elles deux.
    const base = pctTheorique + pctPratique || 1;
    for (const o of liste) {
      resultat.push({
        suggestion_pedagogique_id: o.id,
        heures_theoriques: arrondi((parObjectif * pctTheorique) / base),
        heures_pratiques: arrondi((parObjectif * pctPratique) / base),
      });
    }
  }

  // Les arrondis successifs laissent un reste : sans correction, le formateur
  // verrait une demi-heure manquante qu'il n'a pas perdue. On la reporte sur
  // l'objectif le plus lourd, celui où elle se remarque le moins.
  const ecart = arrondi(aRepartir - totalReparti(resultat));
  if (ecart !== 0 && resultat.length > 0) {
    const plusLourd = resultat.reduce((a, b) =>
      b.heures_theoriques + b.heures_pratiques > a.heures_theoriques + a.heures_pratiques
        ? b
        : a,
    );
    plusLourd.heures_theoriques = Math.max(
      0,
      arrondi(plusLourd.heures_theoriques + ecart),
    );
  }

  return { parts: resultat, heuresEvaluation };
}

export function totalReparti(parts: PartHoraire[]): number {
  return arrondi(
    parts.reduce((s, p) => s + p.heures_theoriques + p.heures_pratiques, 0),
  );
}
