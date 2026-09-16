/**
 * Ce qui rend une question de contrôle impossible ou hors sujet (PRD §4.7bis).
 *
 * Les frontières de mot sont écrites à la main, en Unicode : `\b` ne connaît
 * que l'ASCII et ne voit aucune frontière devant « À » ou « é », si bien que
 * « À partir des observations » passait inaperçu.
 *
 * Relevé sur un sujet de CC réellement généré pour M202 : deux exercices
 * renvoyaient à un « corpus fourni en annexe » qui n'existait nulle part, et
 * une question reprenait une note d'organisation du formateur — « l'heure
 * dédiée à votre année de spécialisation UX ». Le modèle ne le fait pas
 * toujours ; il suffit qu'il le fasse une fois pour qu'un stagiaire perde des
 * points sur une question impossible.
 *
 * Ces vérifications signalent, elles ne corrigent pas : réécrire un énoncé
 * n'est pas à la main d'une expression régulière. Le formateur voit l'alerte
 * sous la question et décide.
 */

/**
 * Un énoncé qui renvoie à une pièce extérieure au sujet.
 *
 * Seulement quand la question n'apporte pas elle-même ses données : « à
 * partir des observations ci-dessous » est juste si les observations sont là.
 */
const PIECE_EXTERIEURE =
  /(?<![\p{L}\p{N}])(en\s+annexe|annexe|ci-joint|ci-jointe|pi[eè]ce\s+jointe|fichier\s+joint|document\s+(fourni|joint|distribu[ée])|corpus\s+(fourni|joint|distribu[ée])|fourni[es]?\s+(par\s+le\s+formateur|en\s+s[ée]ance)|voir\s+le\s+document|support\s+distribu[ée])(?![\p{L}\p{N}])/iu;

/** Un énoncé qui s'appuie sur des données censées suivre. */
const DONNEES_ANNONCEES =
  /(?<![\p{L}\p{N}])(ci-dessous|suivant(e|es|s)?\s*:|[àa]\s+partir\s+(du|des|de\s+la|de\s+l['’])\s+(corpus|donn[ée]es|observations|tableau|verbatims?|extrait|cas))(?![\p{L}\p{N}])/iu;

/**
 * Un énoncé qui parle de la conduite des séances plutôt que du module.
 *
 * Les formulations viennent des notes que les formateurs écrivent dans le
 * contenu réalisé : organisation de l'heure, programme de l'année, rattrapage.
 */
const HORS_NOTIONS =
  /(?<![\p{L}\p{N}])([àa]\s+la\s+fin\s+de\s+(cette|l['’])\s*heure|cette\s+heure|heure\s+d[ée]di[ée]e?|ann[ée]e\s+de\s+sp[ée]cialisation|programme\s+de\s+l['’]ann[ée]e|cette\s+s[ée]ance|la\s+s[ée]ance\s+(pr[ée]c[ée]dente|suivante|d['’]aujourd['’]hui)|s[ée]ance\s+de\s+rattrapage|career\s+week|objectifs?\s+de\s+(la|cette)\s+s[ée]ance)(?![\p{L}\p{N}])/iu;

export type QuestionAVerifier = {
  type: string;
  enonce: string;
  donnees?: string | null;
};

/** Les alertes d'une question, en phrases que le formateur lit telles quelles. */
export function alertesQuestion(q: QuestionAVerifier): string[] {
  const alertes: string[] = [];
  const enonce = q.enonce ?? "";
  const aDesDonnees = Boolean(q.donnees?.trim());

  if (!aDesDonnees && PIECE_EXTERIEURE.test(enonce)) {
    alertes.push(
      "Renvoie à une pièce qui n'est pas dans le sujet (annexe, document fourni…). Ajoutez les données sous l'énoncé, ou reformulez.",
    );
  } else if (!aDesDonnees && DONNEES_ANNONCEES.test(enonce)) {
    alertes.push(
      "Annonce des données (« ci-dessous », « à partir du corpus »…) qui ne sont pas fournies. Ajoutez-les sous l'énoncé.",
    );
  }

  if (HORS_NOTIONS.test(enonce)) {
    alertes.push(
      "Semble porter sur l'organisation des séances plutôt que sur une notion du module.",
    );
  }

  return alertes;
}

/**
 * Retire du contenu réalisé ce qui ressemble à une note d'organisation.
 *
 * Filet de sécurité en amont du modèle : le formateur écrit parfois, dans le
 * contenu réalisé, où il en est de son planning. Une ligne entière qui parle
 * de l'heure, du programme ou d'un rattrapage ne décrit pas une notion
 * enseignée. Les notes à garder pour soi ont désormais leur place, séparée
 * (`notes_seance`), qu'aucun générateur ne lit.
 */
export function sansNotesOrganisation(texte: string): string {
  return texte
    .split(/\n+/)
    .filter((ligne) => !HORS_NOTIONS.test(ligne) && !/^\s*[-*]?\s*(qu['’]est-ce que je vais|sur quoi de la 1[èe]re ann[ée]e)/i.test(ligne))
    .join("\n")
    .trim();
}
