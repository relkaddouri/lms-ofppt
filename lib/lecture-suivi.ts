import type { SuiviStagiaire } from "@/app/actions/suivi";

/**
 * La lecture du suivi d'un stagiaire par le modèle (atome 13.3).
 *
 * Le prompt et la validation vivent ici, hors de la route : un module
 * « use server » n'exporte que des fonctions asynchrones, et ces deux-là se
 * relisent mieux à côté l'une de l'autre.
 *
 * Le modèle ne reçoit **ni nom ni prénom** : il lit des chiffres et des
 * énoncés de questions. Ce qu'il écrit est une lecture pédagogique, pas un
 * jugement sur une personne — et rien ne part vers le modèle qui permette de
 * l'identifier, comme pour l'analyse de compréhension (§4.7bis).
 */

export type LectureSuivi = {
  resume: string;
  forces: string[];
  lacunes: string[];
  conseils: string[];
};

const texte = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

const liste = (v: unknown, max = 4): string[] =>
  (Array.isArray(v) ? v : [])
    .map((x) => texte(x, 240))
    .filter(Boolean)
    .slice(0, max);

/**
 * Ne garde de la réponse que ce qui tient debout.
 *
 * Une lecture sans résumé ne vaut rien : mieux vaut redemander que d'afficher
 * trois puces sans fil conducteur.
 */
export function lectureValide(brut: unknown): LectureSuivi | null {
  const o = (brut ?? {}) as Record<string, unknown>;
  const resume = texte(o.resume, 700);
  if (!resume) return null;
  return {
    resume,
    forces: liste(o.forces),
    lacunes: liste(o.lacunes),
    conseils: liste(o.conseils),
  };
}

/** « 12 tentatives · 4 chapitres lus · 2 contrôles notés » */
export function assiseDe(suivi: SuiviStagiaire): string {
  const lus = suivi.modules.reduce((n, m) => n + m.lus, 0);
  const notes = suivi.controles.filter((c) => c.note !== null).length;
  return [
    `${suivi.quiz.tentatives + suivi.quiz.bilans} tentative${
      suivi.quiz.tentatives + suivi.quiz.bilans > 1 ? "s" : ""
    }`,
    `${lus} chapitre${lus > 1 ? "s" : ""} lu${lus > 1 ? "s" : ""}`,
    `${notes} contrôle${notes > 1 ? "s" : ""} noté${notes > 1 ? "s" : ""}`,
  ].join(" · ");
}

export function promptLecture(suivi: SuiviStagiaire): string {
  const modules = suivi.modules
    .map(
      (m) =>
        `- ${m.libelle} : ${m.lus}/${m.chapitres} chapitres lus, ${m.tentatives} quiz et ${m.bilans} bilan(s) passés, ${
          m.reussite === null ? "jamais testé" : `${m.reussite} % de bonnes réponses`
        }`,
    )
    .join("\n");

  const notions = suivi.notions
    .map((n) => `- ratée ${n.erreurs} fois sur ${n.tentatives} : « ${n.question} »`)
    .join("\n");

  const controles = suivi.controles
    .filter((c) => c.note !== null)
    .map((c) => `- ${c.type} : ${c.note}/${c.total}`)
    .join("\n");

  return [
    "Tu lis le suivi d'un stagiaire de l'OFPPT pour son formateur.",
    "Tu ne connais ni son nom ni son prénom, et tu n'en inventes pas.",
    "",
    "## Son activité",
    `- ${suivi.activite.joursActifs} jour(s) où il a fait quelque chose sur la plateforme`,
    `- ${suivi.activite.actions} action(s) en tout (chapitre lu, quiz passé, devoir remis, copie rendue)`,
    `- ${Math.round(suivi.activite.secondesQuiz / 60)} minute(s) passées à se tester`,
    `- ${suivi.devoirs.remis} devoir(s) remis sur ${suivi.devoirs.total} assigné(s)`,
    suivi.activite.derniere
      ? `- dernière trace le ${suivi.activite.derniere.slice(0, 10)}`
      : "- aucune trace d'activité",
    "",
    "## Son avancement, module par module",
    modules || "- aucun chapitre ne lui a été remis",
    "",
    "## Les questions qu'il rate",
    notions || "- aucune question ratée, ou aucun quiz passé",
    "",
    "## Ses notes de contrôle",
    controles || "- aucune copie notée",
    "",
    "## Ce que tu écris",
    "- `resume` : trois à cinq phrases sur où il en est. Dis ce que les",
    "  chiffres disent, et rien de plus : si personne ne s'est testé, tu ne",
    "  peux pas conclure sur son niveau, dis-le.",
    "- `forces` : ce qui est acquis, appuyé sur un chiffre ou une question",
    "  réussie. Liste vide si rien ne le montre.",
    "- `lacunes` : ce qui ne rentre pas, en citant les notions ratées",
    "  ci-dessus — jamais une lacune que les données ne montrent pas.",
    "- `conseils` : deux à quatre gestes concrets pour le formateur, du genre",
    "  « reprendre la hiérarchisation des données en début de séance » ou",
    "  « lui demander de refaire le quiz du chapitre 3 avant le contrôle ».",
    "- Tout en français, sans jargon, sans flatterie, sans jugement sur la",
    "  personne : on parle de son travail.",
    "",
    "Réponds uniquement en JSON :",
    JSON.stringify(
      { resume: "…", forces: ["…"], lacunes: ["…"], conseils: ["…"] },
      null,
      1,
    ),
  ].join("\n");
}
