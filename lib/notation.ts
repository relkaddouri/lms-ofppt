import { appelerLlm, type ConfigLlm } from "@/lib/llm";

/**
 * Notation d'une copie.
 *
 * Partagée par les deux voies de passation : le lien public hérité et la
 * passation authentifiée. Les laisser diverger reviendrait à noter deux
 * stagiaires du même groupe selon deux règles.
 */

export type OptionNotation = { texte: string; correcte?: boolean };

export type QuestionPourNotation = {
  id: string;
  type: "qcm" | "ouverte" | "exercice" | null;
  enonce: string;
  bareme: number;
  options: OptionNotation[] | null;
  corrige: string;
};

export type ScoreEntry = {
  question: string;
  points: number;
  commentaire: string;
};

export type DetailNote = {
  question_id: string;
  points: number;
  commentaire: string;
  reponse: string;
};

export const normaliser = (s: string) =>
  s.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * Note un QCM sans appeler de modèle : les bonnes réponses sont connues, la
 * comparaison est exacte. Tout ou rien — cocher une mauvaise proposition ou en
 * oublier une bonne annule les points, règle usuelle d'un QCM à réponses
 * multiples.
 */
export function noterQcm(
  q: QuestionPourNotation,
  reponse: string,
  bareme: number,
) {
  const attendues = new Set(
    (q.options ?? []).filter((o) => o.correcte).map((o) => normaliser(o.texte)),
  );
  const cochees = new Set(
    reponse
      .split("\n")
      .map(normaliser)
      .filter((s) => s !== ""),
  );

  if (attendues.size === 0) {
    return { points: 0, commentaire: "Aucune bonne réponse définie pour ce QCM." };
  }

  const exact =
    cochees.size === attendues.size && [...attendues].every((a) => cochees.has(a));
  const nbBonnes = [...cochees].filter((c) => attendues.has(c)).length;
  const nbFausses = cochees.size - nbBonnes;

  return {
    points: exact ? bareme : 0,
    commentaire: exact
      ? "Toutes les bonnes propositions sont cochées."
      : cochees.size === 0
        ? "Aucune proposition cochée."
        : `${nbBonnes} bonne(s) proposition(s) sur ${attendues.size}` +
          (nbFausses > 0 ? `, ${nbFausses} proposition(s) erronée(s).` : "."),
  };
}

/** Questions qui demandent un jugement, donc un appel au modèle. */
export function questionsAJuger(questions: QuestionPourNotation[]) {
  return questions.filter((q) => q.type !== "qcm");
}

function construirePrompt(
  questions: QuestionPourNotation[],
  aJuger: QuestionPourNotation[],
  reponses: Record<string, string>,
  nom: string,
): string {
  return [
    "Tu es un correcteur expert OFPPT. Corrige le contrôle d'un stagiaire.",
    "",
    `Stagiaire : ${nom}`,
    "Pour chaque question, attribue des points sur le barème indiqué, en comparant la réponse du stagiaire au corrigé. Sois strict mais juste.",
    "",
    "Questions :",
    ...aJuger.map((q) => {
      const label = `q${questions.indexOf(q) + 1}`;
      const reponse = reponses[q.id] ?? "";
      return [
        `${label}. Énoncé : ${q.enonce}`,
        `   Barème : ${q.bareme} pts`,
        `   Corrigé : ${q.corrige}`,
        `   Réponse du stagiaire : ${reponse || "(vide)"}`,
      ].join("\n");
    }),
    "",
    "Réponds UNIQUEMENT en JSON (sans markdown) avec la structure :",
    `{"scores":[{"question":"q1","points":X,"commentaire":"courte justification"}]}`,
    "",
    "Règles :",
    '- La clé "question" doit être exactement le libellé de la question (q1, q2, ...).',
    "- Si la réponse du stagiaire correspond au corrigé (identique ou très proche), attribue la totalité des points.",
    "- Points entre 0 et le barème de la question, arrondi au demi-point près.",
  ].join("\n");
}

/**
 * Note une copie entière.
 *
 * Les QCM sont tranchés ici, sans coût ni latence. Le modèle n'est appelé que
 * s'il reste des questions à juger : un contrôle entièrement en QCM se corrige
 * hors ligne.
 */
export async function noterCopie(
  questions: QuestionPourNotation[],
  reponses: Record<string, string>,
  nom: string,
  config: ConfigLlm | null,
): Promise<DetailNote[]> {
  const aJuger = questionsAJuger(questions);

  let scores: ScoreEntry[] = [];
  if (aJuger.length > 0) {
    if (!config) {
      throw new Error(
        "Aucun modèle configuré : la correction des questions ouvertes est impossible.",
      );
    }
    const texte = await appelerLlm(config, {
      systeme: "Tu es un correcteur expert du référentiel OFPPT.",
      prompt: construirePrompt(questions, aJuger, reponses, nom),
      // Une note doit être reproductible d'une copie à l'autre.
      temperature: 0,
      maxTokens: 4000,
      json: true,
    });

    try {
      scores = (JSON.parse(texte) as { scores: ScoreEntry[] }).scores ?? [];
    } catch {
      throw new Error("Le modèle n'a pas retourné un JSON valide.");
    }
  }

  const parLabel = new Map(scores.map((s) => [s.question, s]));

  return questions.map((q, i) => {
    const bareme = Number(q.bareme) || 0;
    const reponse = reponses[q.id] ?? "";

    if (q.type === "qcm") {
      const { points, commentaire } = noterQcm(q, reponse, bareme);
      return { question_id: q.id, points, commentaire, reponse };
    }

    const score = parLabel.get(`q${i + 1}`) ?? parLabel.get(String(i + 1));
    const identique =
      reponse.trim() !== "" &&
      q.corrige != null &&
      normaliser(reponse) === normaliser(q.corrige);

    return {
      question_id: q.id,
      points: identique
        ? bareme
        : Math.min(Math.max(Number(score?.points) || 0, 0), bareme),
      commentaire: identique
        ? "Réponse conforme au corrigé."
        : (score?.commentaire ?? ""),
      reponse,
    };
  });
}
