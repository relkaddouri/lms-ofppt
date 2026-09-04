/**
 * Les quatre phases d'une séance (PRD §4.3ter).
 *
 * Schéma unique, fixe et strictement linéaire : mise en situation, activité,
 * structuration, réinvestissement. Aucune phase conditionnelle — le formateur
 * lit ce qui s'affiche et l'applique, il n'a pas à juger en pleine classe si
 * une condition est remplie.
 *
 * Ces quatre phases **remplacent** l'ancienne structure de fiche
 * (motivation / plan / développement / évaluation / prochaine, minutée bloc
 * par bloc). Garder les deux ferait raconter deux déroulements différents de
 * la même séance à la fiche et au mode animation.
 */

export type ClePhase =
  | "mise_en_situation"
  | "activite"
  | "structuration"
  | "reinvestissement";

export type DefinitionPhase = {
  cle: ClePhase;
  titre: string;
  /** Part indicative de la durée de séance, PRD §4.3ter. */
  part: number;
  /** Ce que la phase cherche à obtenir — affiché au formateur, et donné au modèle. */
  intention: string;
  /**
   * Ce que porte la liste `points` pour cette phase précise. Le champ est le
   * même partout, son sens change : on le nomme donc phase par phase plutôt
   * que d'inventer quatre champs qui ne serviraient chacun qu'une fois.
   */
  libellePoints: string;
};

export const PHASES: DefinitionPhase[] = [
  {
    cle: "mise_en_situation",
    titre: "Mise en situation",
    part: 0.1,
    intention:
      "créer le besoin de savoir — un problème que les stagiaires ne savent pas encore résoudre",
    libellePoints: "Le déclencheur",
  },
  {
    cle: "activite",
    titre: "Activité / exploration",
    part: 0.5,
    intention:
      "les stagiaires cherchent, produisent, se trompent — avant tout apport théorique",
    libellePoints: "À observer pendant qu'ils cherchent",
  },
  {
    cle: "structuration",
    titre: "Structuration",
    part: 0.25,
    intention:
      "nommer ce qui vient d'être vécu, dans l'ordre, et reprendre les erreurs typiques",
    libellePoints: "Notions à nommer et erreurs à reprendre",
  },
  {
    cle: "reinvestissement",
    titre: "Réinvestissement",
    part: 0.15,
    intention:
      "vérifier le transfert sur une situation courte, dans un autre contexte",
    libellePoints: "Ce qui atteste du transfert",
  },
];

export const CLES_PHASES = PHASES.map((p) => p.cle);

export function definitionPhase(cle: ClePhase): DefinitionPhase {
  return PHASES.find((p) => p.cle === cle) ?? PHASES[0]!;
}

export type PhaseFiche = {
  cle: ClePhase;
  /** La méthode active mobilisée pour cette phase précise. */
  methode: string;
  minutes: number;
  /** Ce que le formateur fait et dit, ligne par ligne — prêt à exécuter. */
  instructions: string[];
  /** Les questions à poser telles quelles, sans reformulation. */
  questions: string[];
  /** Selon la phase : déclencheur, points d'observation, notions, preuves de transfert. */
  points: string[];
};

/**
 * Les minutes par défaut des quatre phases, dont la somme tombe juste.
 *
 * Arrondir chaque part séparément au multiple de 5 donnait 15 + 75 + 40 + 25
 * = 155 sur une séance de 150 : quatre arrondis indépendants ne se
 * rattrapent pas. Les trois premières sont arrondies, la dernière prend le
 * reste — le même report que la répartition horaire d'un module.
 */
export function minutesParDefaut(minutesSeance: number | null): number[] {
  if (!minutesSeance || minutesSeance <= 0) return PHASES.map(() => 0);
  const debut = PHASES.slice(0, -1).map(
    (def) => Math.round((minutesSeance * def.part) / 5) * 5,
  );
  const reste = minutesSeance - debut.reduce((t, m) => t + m, 0);
  return [...debut, Math.max(0, reste)];
}

/** Une phase vide, pour que l'écran d'édition ait toujours ses quatre lignes. */
export function phaseVide(cle: ClePhase, minutes = 0): PhaseFiche {
  return {
    cle,
    methode: "",
    minutes: Math.max(0, Math.round(minutes)),
    instructions: [],
    questions: [],
    points: [],
  };
}

/** Les quatre phases dans l'ordre, complétées de ce qui manque. */
export function quatrePhases(
  brut: unknown,
  minutesSeance: number | null,
): PhaseFiche[] {
  const liste = Array.isArray(brut) ? brut : [];
  const defauts = minutesParDefaut(minutesSeance);
  return PHASES.map((def, i) => {
    const trouvee = liste.find(
      (p) => (p as { cle?: unknown })?.cle === def.cle,
    ) as Partial<PhaseFiche> | undefined;
    if (!trouvee) return phaseVide(def.cle, defauts[i]);
    return {
      cle: def.cle,
      methode: String(trouvee.methode ?? "").trim(),
      minutes: Math.max(0, Math.round(Number(trouvee.minutes) || 0)),
      instructions: lignes(trouvee.instructions),
      questions: lignes(trouvee.questions),
      points: lignes(trouvee.points),
    };
  });
}

function lignes(v: unknown, max = 12): string[] {
  const brut = Array.isArray(v) ? v : typeof v === "string" ? v.split("\n") : [];
  return brut
    .map((l) => String(l ?? "").replace(/^\s*[-–•*]\s*|^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, max);
}

/**
 * Reprend une fiche écrite avant les phases.
 *
 * Deux fiches existent déjà en base au format minuté. Les ignorer les
 * effacerait de l'écran ; les convertir place leur contenu dans la phase la
 * plus proche, à charge du formateur d'ajuster. Le rapprochement est celui-ci,
 * assumé comme approximatif : l'accroche ouvre, le plan et le développement
 * sont le temps de recherche, l'évaluation est le moment où l'on nomme, et ce
 * qu'on prévoit pour la suite est le transfert.
 */
export function phasesDepuisAncienneFiche(
  brut: Record<string, unknown>,
  minutesSeance: number | null,
): PhaseFiche[] | null {
  if (!Array.isArray(brut.developpement)) return null;

  const bloc = (v: unknown) => {
    const o = (v ?? {}) as { contenu?: unknown; minutes?: unknown };
    return {
      contenu: String(o.contenu ?? "").trim(),
      minutes: Math.max(0, Math.round(Number(o.minutes) || 0)),
    };
  };

  const motivation = bloc(brut.motivation);
  const plan = bloc(brut.plan);
  const evaluation = bloc(brut.evaluation);
  const prochaine = bloc(brut.prochaine);
  const dev = (brut.developpement as unknown[]).map((l) => {
    const o = (l ?? {}) as { strategie?: unknown; contenu?: unknown; minutes?: unknown };
    return {
      strategie: String(o.strategie ?? "").trim(),
      contenu: String(o.contenu ?? "").trim(),
      minutes: Math.max(0, Math.round(Number(o.minutes) || 0)),
    };
  });

  const defauts = minutesParDefaut(minutesSeance);
  const phases = PHASES.map((def, i) => phaseVide(def.cle, defauts[i]));
  const par = (cle: ClePhase) => phases.find((p) => p.cle === cle)!;

  const mise = par("mise_en_situation");
  mise.instructions = lignes(motivation.contenu);
  mise.minutes = motivation.minutes;

  const act = par("activite");
  act.instructions = lignes(
    [plan.contenu, ...dev.map((d) => d.contenu)].filter(Boolean).join("\n"),
    20,
  );
  act.methode = dev[0]?.strategie ?? "";
  act.minutes = plan.minutes + dev.reduce((s, d) => s + d.minutes, 0);

  const str = par("structuration");
  str.instructions = lignes(evaluation.contenu);
  str.minutes = evaluation.minutes;

  const rei = par("reinvestissement");
  rei.instructions = lignes(prochaine.contenu);
  rei.minutes = prochaine.minutes;

  return phases;
}
