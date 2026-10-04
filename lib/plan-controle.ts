/**
 * De quoi un sujet est fait : combien de travail il demande, et dans quel ordre.
 *
 * Deux défauts se corrigent ici, relevés sur un CC de 2 h 30 qui ressemblait
 * trait pour trait au précédent.
 *
 * Le volume ne tenait aucun compte de la durée : la seule règle était « entre
 * 8 et 14 questions », identique pour une heure comme pour trois. Une épreuve
 * longue recevait donc le sujet d'une épreuve courte.
 *
 * Et l'ordre était prescrit — « commence par les connaissances, termine par
 * les mises en situation » —, de sorte que tous les sujets d'un module se
 * suivaient à l'identique. Un stagiaire qui passe trois contrôles apprend la
 * forme avant le fond, et la forme ne s'évalue pas.
 */

/** Ce que chaque type de question coûte au stagiaire, en minutes. */
export const MINUTES_PAR_TYPE = {
  /** Lire quatre propositions et trancher. */
  qcm: 1.5,
  /** Rédiger quelques phrases justes. */
  ouverte: 5,
  /** Lire un jeu de données, l'analyser, produire un livrable écrit. */
  exercice: 18,
} as const;

/**
 * Le temps réellement disponible pour répondre.
 *
 * On retire 15 % : lire les consignes, revenir sur une réponse, relire avant
 * de rendre. Un sujet calibré sur la durée pleine est un sujet qu'on ne finit
 * pas, et ce n'est pas la compétence qu'on évalue.
 */
export function budgetMinutes(dureeHeures: number): number {
  const total = (Number(dureeHeures) || 2) * 60;
  return Math.max(20, Math.round(total * 0.85));
}

export type Architecture = {
  nom: string;
  /** Les formats auxquels ce plan convient. */
  formats: readonly ("theorique" | "pratique" | "mixte")[];
  consigne: string;
};

/**
 * Les formes qu'un sujet peut prendre.
 *
 * Elles ne se valent pas toutes pour un module donné, mais elles sont toutes
 * défendables : ce sont des manières d'évaluer, pas des habillages. Ce qui
 * compte est qu'un stagiaire ne puisse pas deviner la suivante.
 */
export const ARCHITECTURES: readonly Architecture[] = [
  {
    nom: "progressif",
    formats: ["theorique", "mixte"],
    consigne:
      "Plan PROGRESSIF : commence par les questions de connaissances, puis " +
      "termine par les mises en situation, de difficulté croissante.",
  },
  {
    nom: "cas d'abord",
    formats: ["mixte", "pratique"],
    consigne:
      "Plan CAS D'ABORD : ouvre le sujet par une mise en situation complète, " +
      "avec ses données. Les questions de connaissances viennent ensuite, et " +
      "chacune éclaire une notion que ce cas a mobilisée. Termine par une " +
      "seconde mise en situation, sur un contexte différent du premier.",
  },
  {
    nom: "fil rouge",
    formats: ["mixte", "pratique"],
    consigne:
      "Plan FIL ROUGE : tout le sujet porte sur UNE seule situation " +
      "professionnelle, décrite une fois au début dans les données de la " +
      "première question. Les questions suivantes en sont les étapes " +
      "successives, et alternent restitution de notions et production de " +
      "livrables. Chaque question reste autonome : elle rappelle brièvement " +
      "ce dont elle a besoin plutôt que de renvoyer à une autre.",
  },
  {
    nom: "alterné",
    formats: ["mixte"],
    consigne:
      "Plan ALTERNÉ : alterne par blocs de deux — deux questions de " +
      "connaissances, puis une mise en situation qui les applique, et ainsi " +
      "de suite. Le stagiaire ne doit jamais enchaîner plus de deux questions " +
      "de même nature.",
  },
  {
    nom: "critique et correction",
    formats: ["mixte", "pratique"],
    consigne:
      "Plan CRITIQUE ET CORRECTION : commence par présenter, dans les " +
      "données, un livrable professionnel DÉJÀ PRODUIT et volontairement " +
      "imparfait (une fiche mal construite, une analyse incomplète, un " +
      "tableau erroné). La première question demande de relever ce qui ne va " +
      "pas et pourquoi ; la deuxième demande de le refaire correctement. Les " +
      "questions de connaissances viennent après, sur les notions que cette " +
      "correction a mises en jeu.",
  },
  {
    nom: "du terrain aux notions",
    formats: ["theorique", "mixte"],
    consigne:
      "Plan DU TERRAIN AUX NOTIONS : chaque question de connaissances part " +
      "d'un fait concret écrit dans ses données — un verbatim d'utilisateur, " +
      "une observation, une mesure — et demande ce que ce fait signifie au " +
      "regard des notions du module. Les mises en situation, s'il y en a, " +
      "closent le sujet.",
  },
];

/**
 * Le plan d'un nouveau sujet, choisi pour ne pas répéter le précédent.
 *
 * Le choix tourne sur le nombre de contrôles déjà écrits pour ce module plutôt
 * que d'être tiré au hasard : au hasard, deux sujets de suite peuvent tomber
 * sur la même forme, ce qui est exactement ce qu'on cherche à éviter.
 */
export function choisirArchitecture(
  format: "theorique" | "pratique" | "mixte",
  controlesDeja: number,
): Architecture {
  const possibles = ARCHITECTURES.filter((a) => a.formats.includes(format));
  // Un format sans plan déclaré garde le plan progressif : mieux vaut la
  // forme connue que pas de forme du tout.
  if (possibles.length === 0) return ARCHITECTURES[0]!;
  const i = Math.abs(Math.trunc(controlesDeja)) % possibles.length;
  return possibles[i]!;
}

/**
 * Comment le temps se partage entre les types, selon le format du contrôle.
 *
 * Un contrôle pratique passe l'essentiel de sa durée en production ; un
 * contrôle théorique la passe en restitution. Les parts sont des parts de
 * TEMPS, pas de points : c'est le temps qui dit combien de questions, et les
 * points se répartissent ensuite.
 */
const PARTS_DU_TEMPS = {
  theorique: { qcm: 0.35, ouverte: 0.65, exercice: 0 },
  pratique: { qcm: 0, ouverte: 0, exercice: 1 },
  mixte: { qcm: 0.1, ouverte: 0.3, exercice: 0.6 },
} as const;

/**
 * Au-delà, un sujet cesse d'être lisible.
 *
 * Une épreuve théorique longue remplirait son budget avec quarante questions ;
 * personne ne relit quarante énoncés, et le modèle les rédige de moins en
 * moins bien à mesure qu'ils s'accumulent. On plafonne, quitte à ne pas
 * occuper toute la durée — ce cas se présente surtout pour un format
 * théorique, qui n'est pas celui d'une épreuve de deux heures et demie.
 */
const PLAFOND_QUESTIONS = 24;

export type Composition = { qcm: number; ouverte: number; exercice: number };

/**
 * Combien de questions, et de quels types.
 *
 * Calculé ici plutôt que demandé au modèle. Deux essais réels l'ont montré :
 * à qui on donne un budget en minutes et la liberté d'en déduire un volume,
 * il produit systématiquement trop court — neuf questions puis dix, pour un
 * budget qui en appelait une vingtaine. Il suit en revanche parfaitement un
 * nombre donné. On fait donc l'arithmétique à sa place.
 */
export function composition(
  dureeHeures: number,
  format: "theorique" | "pratique" | "mixte",
): Composition {
  const budget = budgetMinutes(dureeHeures);
  const parts = PARTS_DU_TEMPS[format];

  const brut = {
    qcm: Math.round((budget * parts.qcm) / MINUTES_PAR_TYPE.qcm),
    ouverte: Math.round((budget * parts.ouverte) / MINUTES_PAR_TYPE.ouverte),
    exercice: Math.round((budget * parts.exercice) / MINUTES_PAR_TYPE.exercice),
  };

  // Un type qui compte dans le format en a toujours au moins un : une part
  // arrondie à zéro ferait disparaître une nature de question d'un contrôle
  // censé la comporter.
  for (const t of ["qcm", "ouverte", "exercice"] as const) {
    if (parts[t] > 0 && brut[t] < 1) brut[t] = 1;
  }

  const total = brut.qcm + brut.ouverte + brut.exercice;
  if (total <= PLAFOND_QUESTIONS) return brut;

  const facteur = PLAFOND_QUESTIONS / total;
  return {
    qcm: parts.qcm > 0 ? Math.max(1, Math.round(brut.qcm * facteur)) : 0,
    ouverte: parts.ouverte > 0 ? Math.max(1, Math.round(brut.ouverte * facteur)) : 0,
    exercice: parts.exercice > 0 ? Math.max(1, Math.round(brut.exercice * facteur)) : 0,
  };
}

/**
 * Le budget de travail, dit au modèle dans les termes où il peut l'appliquer.
 *
 * On lui donne un coût par type et un total à atteindre, pas un nombre de
 * questions : c'est la durée de l'épreuve qui doit fixer le volume, et un
 * sujet de 2 h 30 n'est pas un sujet d'une heure avec des points en plus.
 */
export function consigneBudget(
  dureeHeures: number,
  format: "theorique" | "pratique" | "mixte",
): string[] {
  const budget = budgetMinutes(dureeHeures);
  const c = composition(dureeHeures, format);
  const total = c.qcm + c.ouverte + c.exercice;

  const lignes = (["qcm", "ouverte", "exercice"] as const)
    .filter((t) => c[t] > 0)
    .map(
      (t) =>
        `   - ${c[t]} de type "${t}" (environ ${MINUTES_PAR_TYPE[t]} minutes chacune)`,
    );

  return [
    "VOLUME — ces nombres sont impératifs.",
    `L'épreuve dure ${String(dureeHeures).replace(".", ",")} heures, soit environ`,
    `${budget} minutes utiles une fois retirés le temps de lecture et de`,
    "relecture. Ce volume en découle. Produis EXACTEMENT :",
    ...lignes,
    `soit ${total} questions au total.`,
    "Ce n'est pas un ordre de grandeur. Un sujet plus court laisse le stagiaire",
    "rendre sa copie au tiers du temps, ce qui n'évalue plus rien.",
  ];
}
