/**
 * L'analyse de compréhension d'un contrôle — la partie qui se calcule
 * (PRD §4.7bis, atome 10.6).
 *
 * Les chiffres ne se demandent pas au modèle : taux de réussite, réponses
 * vides, répartition de la classe, stagiaires en difficulté se comptent sur
 * les copies, exactement. Le modèle reçoit ces faits et lit les réponses pour
 * dire ce qu'ils signifient — quelles erreurs reviennent, quelles notions ne
 * sont pas acquises, quoi reprendre.
 *
 * Les noms restent ici. Chaque stagiaire devient « Stagiaire A », « B »… dans
 * l'ordre de la note, et seule cette correspondance, gardée côté serveur,
 * permet au formateur de savoir qui est qui.
 */

export type EtatComprehension = "acquis" | "fragile" | "non_acquis";

/** Ce que le modèle lit dans les copies, une fois validé par la route. */
export type LectureAnalyse = {
  niveau: { appreciation: string; resume: string };
  questions: {
    numero: number;
    etat: EtatComprehension;
    erreurs_frequentes: string[];
    lecture: string;
  }[];
  notions: {
    notion: string;
    etat: EtatComprehension;
    questions: number[];
    constat: string;
  }[];
  stagiaires: { pseudo: string; constat: string; accompagnement: string }[];
  ajustements: {
    action: string;
    pourquoi: string;
    seance: string | null;
    duree_minutes: number | null;
  }[];
};

export type CopiePourAnalyse = {
  nom: string;
  details: {
    question_id: string;
    points: number | string | null;
    reponse: string | null;
    commentaire: string | null;
  }[];
};

export type QuestionPourAnalyse = {
  id: string;
  type: string;
  enonce: string;
  bareme: number;
  corrige: string | null;
};

export type StatQuestion = {
  numero: number;
  question_id: string;
  type: string;
  bareme: number;
  /** Moyenne des points obtenus, rapportée au barème : 0 à 100. */
  taux: number;
  /** Part des copies qui obtiennent au moins la moitié des points. */
  reussite: number;
  vides: number;
  etat: EtatComprehension;
};

export type StatStagiaire = {
  pseudo: string;
  note: number;
  /** 0 à 100. */
  taux: number;
  /** Numéros des questions sous la moitié des points. */
  echecs: number[];
};

export type Statistiques = {
  nbCopies: number;
  total: number;
  moyenne: number;
  mediane: number;
  /** Nombre de copies par tranche de réussite. */
  repartition: { moins40: number; de40a60: number; de60a80: number; plus80: number };
  questions: StatQuestion[];
  stagiaires: StatStagiaire[];
  /** Pseudonymes des stagiaires sous 50 % : ceux que l'analyse regarde en priorité. */
  aAccompagner: string[];
};

/** Seuils de lecture d'un taux : au-delà de 70 %, acquis ; sous 40 %, non acquis. */
export function etatDe(taux: number): EtatComprehension {
  if (taux >= 70) return "acquis";
  if (taux >= 40) return "fragile";
  return "non_acquis";
}

const arrondi = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

/** A, B… Z, puis AA, AB… : assez pour un groupe, sans jamais réutiliser une lettre. */
export function pseudo(i: number): string {
  let n = i;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return `Stagiaire ${s}`;
}

export function statistiquesCopies(
  questions: QuestionPourAnalyse[],
  copies: CopiePourAnalyse[],
): { statistiques: Statistiques; pseudonymes: Record<string, string> } {
  const total = questions.reduce((t, q) => t + (Number(q.bareme) || 0), 0);

  const lignes = copies.map((c) => {
    const parQuestion = new Map(c.details.map((d) => [d.question_id, d]));
    const points = questions.map((q) =>
      Math.min(Number(q.bareme) || 0, Math.max(0, Number(parQuestion.get(q.id)?.points) || 0)),
    );
    return {
      nom: c.nom,
      parQuestion,
      points,
      note: points.reduce((t, p) => t + p, 0),
    };
  });

  // Pseudonymes dans l'ordre décroissant des notes, puis du nom : l'ordre
  // alphabétique des noms trahirait l'identité à qui connaît le groupe.
  const tries = [...lignes].sort((a, b) => b.note - a.note || a.nom.localeCompare(b.nom, "fr"));
  const pseudonymes: Record<string, string> = {};
  const pseudoDe = new Map<(typeof lignes)[number], string>();
  tries.forEach((l, i) => {
    pseudoDe.set(l, pseudo(i));
    pseudonymes[pseudo(i)] = l.nom;
  });

  const statsQuestions: StatQuestion[] = questions.map((q, k) => {
    const b = Number(q.bareme) || 0;
    const obtenus = lignes.map((l) => l.points[k]!);
    const taux = lignes.length && b > 0
      ? (obtenus.reduce((t, p) => t + p, 0) / (lignes.length * b)) * 100
      : 0;
    const reussite = lignes.length && b > 0
      ? (obtenus.filter((p) => p >= b / 2).length / lignes.length) * 100
      : 0;
    const vides = lignes.filter((l) => !(l.parQuestion.get(q.id)?.reponse ?? "").trim()).length;
    return {
      numero: k + 1,
      question_id: q.id,
      type: q.type,
      bareme: b,
      taux: arrondi(taux),
      reussite: arrondi(reussite),
      vides,
      etat: etatDe(taux),
    };
  });

  const stagiaires: StatStagiaire[] = tries.map((l) => ({
    pseudo: pseudoDe.get(l)!,
    note: arrondi(l.note, 2),
    taux: total > 0 ? arrondi((l.note / total) * 100) : 0,
    echecs: questions
      .map((q, k) => ((Number(q.bareme) || 0) > 0 && l.points[k]! < (Number(q.bareme) || 0) / 2 ? k + 1 : null))
      .filter((n): n is number => n !== null),
  }));

  const notes = tries.map((l) => l.note).sort((a, b) => a - b);
  const milieu = Math.floor(notes.length / 2);
  const mediane = notes.length === 0
    ? 0
    : notes.length % 2
      ? notes[milieu]!
      : (notes[milieu - 1]! + notes[milieu]!) / 2;

  const repartition = { moins40: 0, de40a60: 0, de60a80: 0, plus80: 0 };
  for (const s of stagiaires) {
    if (s.taux < 40) repartition.moins40++;
    else if (s.taux < 60) repartition.de40a60++;
    else if (s.taux < 80) repartition.de60a80++;
    else repartition.plus80++;
  }

  return {
    statistiques: {
      nbCopies: lignes.length,
      total,
      moyenne: lignes.length ? arrondi(notes.reduce((t, n) => t + n, 0) / lignes.length, 2) : 0,
      mediane: arrondi(mediane, 2),
      repartition,
      questions: statsQuestions,
      stagiaires,
      aAccompagner: stagiaires.filter((s) => s.taux < 50).map((s) => s.pseudo),
    },
    pseudonymes,
  };
}

const echapper = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Remplace, dans un texte, les noms et prénoms du groupe par les pseudonymes.
 *
 * Le correcteur a reçu le nom du stagiaire : son commentaire commence parfois
 * par « Karim, votre réponse… ». Et un stagiaire signe quelquefois sa copie.
 * Chaque mot d'au moins trois lettres d'un nom complet est remplacé, du plus
 * long au plus court, pour qu'« EL KADDOURI » ne laisse pas « KADDOURI »
 * derrière lui.
 */
export function sansNoms(texte: string, pseudonymes: Record<string, string>): string {
  const motifs: { motif: RegExp; pseudo: string; longueur: number }[] = [];
  for (const [pseudoStagiaire, nom] of Object.entries(pseudonymes)) {
    const morceaux = [nom.trim(), ...nom.trim().split(/\s+/)].filter((m) => m.length >= 3);
    for (const m of new Set(morceaux)) {
      motifs.push({
        motif: new RegExp(`(?<![\\p{L}\\p{N}])${echapper(m)}(?![\\p{L}\\p{N}])`, "giu"),
        pseudo: pseudoStagiaire,
        longueur: m.length,
      });
    }
  }
  return motifs
    .sort((a, b) => b.longueur - a.longueur)
    .reduce((t, { motif, pseudo: p }) => t.replace(motif, p), texte);
}

/**
 * Les réponses, pseudonymisées et tronquées pour tenir dans un appel.
 *
 * Le budget se partage entre les réponses : un groupe de trente stagiaires sur
 * dix questions ouvertes ne doit pas faire exploser l'appel, ni un groupe de
 * cinq perdre la moitié de ses réponses pour rien.
 */
export function reponsesAnonymes(
  questions: QuestionPourAnalyse[],
  copies: CopiePourAnalyse[],
  pseudonymes: Record<string, string>,
  budget = 60_000,
): string {
  const pseudoDuNom = new Map(Object.entries(pseudonymes).map(([p, n]) => [n, p]));
  const nbReponses = Math.max(1, questions.length * copies.length);
  const parReponse = Math.max(120, Math.min(900, Math.floor(budget / nbReponses)));
  const coupe = (t: string) =>
    t.length > parReponse ? `${t.slice(0, parReponse)}…` : t;

  return questions
    .map((q, k) => {
      const lignes = copies
        .map((c) => {
          const d = c.details.find((x) => x.question_id === q.id);
          const rep = (d?.reponse ?? "").replace(/\s+/g, " ").trim();
          const p = Number(d?.points) || 0;
          const com = (d?.commentaire ?? "").replace(/\s+/g, " ").trim();
          return `- ${pseudoDuNom.get(c.nom)} (${p}/${q.bareme}) : ${
            rep ? coupe(sansNoms(rep, pseudonymes)) : "[sans réponse]"
          }${com ? ` — correction : ${coupe(sansNoms(com, pseudonymes))}` : ""}`;
        })
        .sort();
      return [
        `### Question ${k + 1} (${q.type}, ${q.bareme} pts)`,
        q.enonce.trim(),
        q.corrige?.trim() ? `Réponse attendue : ${coupe(q.corrige.trim())}` : null,
        "Réponses :",
        ...lignes,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}
