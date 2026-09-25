import type { Support } from "@/lib/support";

/**
 * Le quiz d'auto-évaluation d'un chapitre (PRD §4.5bis, migration 098).
 *
 * Quelques questions à choix multiple tirées du support, corrigées sur-le-champ
 * avec l'explication de la bonne réponse. Ni note ni classement : le stagiaire
 * se teste, se trompe, comprend pourquoi, recommence.
 *
 * Une seule bonne réponse par question, et c'est délibéré : un QCM à réponses
 * multiples se corrige tout ou rien, ce qui n'apprend rien à qui en oublie une.
 */

export const NB_QUESTIONS_QUIZ = 5;

/** Un bilan tous les trois chapitres (PRD §4.5bis). */
export const CHAPITRES_PAR_BILAN = 3;
export const NB_QUESTIONS_BILAN = 8;

/**
 * Les jalons d'un module : un bilan par groupe de trois chapitres.
 *
 * Seuls les groupes complets donnent un bilan. Les deux derniers chapitres
 * d'un module qui en compte onze attendent le troisième : un « bilan » sur
 * deux cours ne ferait pas le lien qu'on en attend, et il faudrait le
 * réécrire à la séance suivante.
 */
export function jalonsDeBilan<T>(chapitres: T[]): { rang: number; chapitres: T[] }[] {
  const jalons: { rang: number; chapitres: T[] }[] = [];
  for (let i = 0; i + CHAPITRES_PAR_BILAN <= chapitres.length; i += CHAPITRES_PAR_BILAN) {
    jalons.push({
      rang: jalons.length + 1,
      chapitres: chapitres.slice(i, i + CHAPITRES_PAR_BILAN),
    });
  }
  return jalons;
}

export type QuestionQuiz = {
  question: string;
  /** Trois ou quatre propositions, dans l'ordre où elles s'affichent. */
  propositions: string[];
  /** Index de la bonne proposition dans `propositions`. */
  bonne: number;
  /** Pourquoi c'est celle-là : lu après la réponse, juste ou fausse. */
  explication: string;
};

export type Quiz = {
  questions: QuestionQuiz[];
  modele: string | null;
  genereLe: string;
};

/**
 * Le texte du support, tel qu'on le donne à lire au modèle.
 *
 * Un cours rédigé arrive d'un bloc ; un cours structuré se recompose section
 * par section ; un TP donne son contexte, ses consignes et ses critères — on
 * interroge alors sur la démarche, pas sur le livrable d'un autre.
 */
export function texteDuSupport(support: Support): string {
  if (support.type === "pratique") {
    return [
      `Titre : ${support.titre}`,
      `Contexte : ${support.contexte}`,
      `Objectif : ${support.objectif}`,
      support.consignes.length
        ? `Consignes :\n- ${support.consignes.join("\n- ")}`
        : null,
      `Livrable attendu : ${support.livrable}`,
      support.criteres.length
        ? `Critères d'évaluation :\n- ${support.criteres
            .map((c) => `${c.critere} (${c.points} pts)`)
            .join("\n- ")}`
        : null,
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  if (support.markdown?.trim()) {
    return `Titre : ${support.titre}\n\n${support.markdown.trim()}`;
  }

  return [
    `Titre : ${support.titre}`,
    support.introduction ? `Introduction : ${support.introduction}` : null,
    ...support.sections.map((s) =>
      [
        `## ${s.titre}`,
        s.notions.length ? `- ${s.notions.join("\n- ")}` : null,
        s.exemple ? `Exemple : ${s.exemple}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    ),
    support.aRetenir.length
      ? `À retenir :\n- ${support.aRetenir.join("\n- ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

const texte = (v: unknown, max = 600) => String(v ?? "").trim().slice(0, max);

/**
 * Ne garde d'une réponse du modèle que ce qui tient debout.
 *
 * Une question sans bonne réponse identifiable, ou à propositions
 * indiscernables, vaut mieux jetée : un quiz de révision qui corrige à tort
 * est pire que pas de quiz.
 */
export function questionsValides(
  brut: unknown,
  maximum: number = NB_QUESTIONS_QUIZ,
): QuestionQuiz[] {
  const liste = Array.isArray(brut) ? brut : [];
  const retenues: QuestionQuiz[] = [];

  for (const q of liste) {
    const o = (q ?? {}) as Record<string, unknown>;
    const question = texte(o.question, 400);
    const propositions = (Array.isArray(o.propositions) ? o.propositions : [])
      .map((p) => texte(p, 300))
      .filter(Boolean);
    const uniques = new Set(propositions.map((p) => p.toLowerCase()));
    const bonne = Number(o.bonne);

    if (
      !question ||
      propositions.length < 3 ||
      propositions.length > 4 ||
      uniques.size !== propositions.length ||
      !Number.isInteger(bonne) ||
      bonne < 0 ||
      bonne >= propositions.length
    ) {
      continue;
    }

    retenues.push({
      question,
      propositions,
      bonne,
      explication: texte(o.explication, 600),
    });
    if (retenues.length >= maximum) break;
  }

  return retenues;
}
