/**
 * Forme des supports remis aux stagiaires (PRD §4.4).
 *
 * Ici et non dans la route de génération : le composant d'édition, la lecture
 * côté stagiaire, le diaporama et le PDF s'en servent tous. Un type qui vit
 * dans une route d'API oblige quatre écrans à importer une route.
 */

/**
 * Une ressource citée par le support.
 *
 * `origine` dit d'où elle vient, et c'est ce qui décide de la confiance :
 * `fiche` — le formateur l'a écrite lui-même dans sa préparation, elle fait
 * foi ; `proposee` — le modèle l'a suggérée, elle est à vérifier avant de la
 * mettre devant une classe.
 */
export type RessourceSupport = {
  titre: string;
  url: string | null;
  /** Ce que le stagiaire y trouve, et pourquoi elle est là. */
  pourquoi: string;
  origine: "fiche" | "proposee";
  /**
   * Résultat de la vérification du lien, faite à la génération.
   * `null` quand il n'y a pas d'URL à vérifier.
   */
  joignable: boolean | null;
};

/**
 * Une figure : un schéma décrit en étapes, pas une image.
 *
 * L'application ne produit pas d'image — en fabriquer une de toutes pièces
 * serait inventer ce qu'on ne sait pas dessiner. Une suite d'étapes nommées
 * se rend proprement à l'écran comme au PDF, et dit la même chose.
 */
export type SchemaSupport = {
  titre: string;
  /** Les étapes ou éléments, dans l'ordre de lecture. */
  etapes: string[];
  legende: string | null;
};

export type SectionCours = {
  titre: string;
  notions: string[];
  exemple: string | null;
  schema: SchemaSupport | null;
};

export type SupportTheorique = {
  type: "theorique";
  titre: string;
  introduction: string;
  sections: SectionCours[];
  aRetenir: string[];
  ressources: RessourceSupport[];
};

export type CritereTp = { critere: string; points: number };

export type SupportPratique = {
  type: "pratique";
  titre: string;
  contexte: string;
  objectif: string;
  consignes: string[];
  livrable: string;
  criteres: CritereTp[];
  ressources: RessourceSupport[];
};

export type Support = SupportTheorique | SupportPratique;

/**
 * Les ressources qu'une fiche de préparation annonce.
 *
 * §4.4 : « si la fiche évoque "voir la vidéo sur X", ce n'est jamais une
 * référence dans le vide ». Encore faut-il savoir ce qu'elle évoque. Deux
 * gisements : le champ « fichiers de travail », que le formateur remplit
 * lui-même, et les URL semées dans les phases.
 */
export function ressourcesDeLaFiche(fiche: {
  fichiers?: string;
  phases?: { instructions: string[]; questions: string[]; points: string[] }[];
}): string[] {
  const trouvees: string[] = [];

  for (const part of (fiche.fichiers ?? "").split(/[;,\n]/)) {
    const t = part.trim();
    // « - » est la valeur par défaut du champ : elle n'annonce rien.
    if (t && t !== "-" && t.length > 2) trouvees.push(t);
  }

  const texte = (fiche.phases ?? [])
    .flatMap((p) => [...p.instructions, ...p.questions, ...p.points])
    .join("\n");
  for (const url of texte.match(/https?:\/\/[^\s)"'»]+/g) ?? []) {
    trouvees.push(url);
  }

  return [...new Set(trouvees)];
}

/**
 * Vrai quand le support honore la ressource annoncée par la fiche.
 *
 * Une URL doit s'y retrouver telle quelle ; un intitulé libre — « la vidéo
 * de Nielsen sur les heuristiques » — se cherche par ses mots porteurs, car
 * personne ne le recopiera au caractère près.
 */
export function ressourceHonoree(annoncee: string, support: Support): boolean {
  const foin = JSON.stringify(support).toLowerCase();
  const aiguille = annoncee.toLowerCase().trim();

  if (/^https?:\/\//.test(aiguille)) return foin.includes(aiguille);

  const mots = aiguille
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((m) => m.length > 3);
  if (mots.length === 0) return foin.includes(aiguille);
  return mots.every((m) => foin.includes(m));
}
