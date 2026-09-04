/**
 * Vocabulaire de la pédagogie active et de l'Approche Par Compétences
 * (PRD §4.3).
 *
 * Deux exigences du PRD tiennent à ce fichier :
 *
 * - l'**objectif** d'une fiche se formule comme un agir en situation, jamais
 *   comme une transmission de savoir ;
 * - la **méthode** mobilisée change d'une séance à l'autre, ce qui suppose
 *   qu'on sache les nommer de la même façon d'une fiche à la suivante — sans
 *   quoi « travail en sous-groupes » et « travail de groupe » passeraient pour
 *   deux méthodes différentes et la variété serait une illusion.
 */

/** Une méthode active, telle qu'elle s'écrit dans une fiche. */
export type MethodeActive = {
  /** Forme canonique, celle qu'on affiche et qu'on compare. */
  nom: string;
  /** Ce que fait le stagiaire — jamais ce que fait le formateur. */
  description: string;
};

/**
 * Le répertoire proposé au modèle.
 *
 * Il n'est pas fermé — une méthode pertinente hors liste reste acceptable —
 * mais il donne l'étalon de nommage et évite que le modèle retombe toujours
 * sur « questions-réponses », qui est son réflexe par défaut.
 */
export const METHODES_ACTIVES: MethodeActive[] = [
  {
    nom: "Étude de cas",
    description:
      "les stagiaires analysent une situation professionnelle réelle et en tirent les principes",
  },
  {
    nom: "Résolution de problème",
    description:
      "les stagiaires cherchent une solution avant qu'on leur donne la notion qui la porte",
  },
  {
    nom: "Travail en sous-groupes",
    description:
      "chaque groupe traite une part du sujet puis la restitue aux autres",
  },
  {
    nom: "Brainstorming",
    description:
      "production libre d'idées, puis tri et hiérarchisation par les stagiaires eux-mêmes",
  },
  {
    nom: "Démonstration puis pratique guidée",
    description:
      "le formateur montre le geste en le verbalisant, les stagiaires le refont sous supervision",
  },
  {
    nom: "Jeu de rôle",
    description:
      "les stagiaires tiennent les rôles de la situation professionnelle (client, designer, utilisateur)",
  },
  {
    nom: "Classe inversée",
    description:
      "la notion est découverte avant la séance, le temps de classe sert à l'appliquer",
  },
  {
    nom: "Débat argumenté",
    description:
      "deux positions défendues sur un choix de conception, arbitrées sur critères",
  },
  {
    nom: "Carte mentale collective",
    description:
      "les stagiaires construisent la structure de la notion au tableau, ensemble",
  },
  {
    nom: "Apprentissage par les pairs",
    description:
      "un stagiaire qui a compris explique à un autre, le formateur circule",
  },
  {
    nom: "Analyse critique de production",
    description:
      "les stagiaires critiquent une production existante — bonne ou mauvaise — sur les critères du référentiel",
  },
  {
    nom: "Situation-problème contextualisée",
    description:
      "une commande professionnelle complète, dont la résolution mobilise toute la séance",
  },
];

/**
 * Verbes proscrits dans un objectif pédagogique.
 *
 * Ils décrivent un état mental intérieur, pas un agir observable : personne ne
 * peut constater qu'un stagiaire « connaît » quelque chose. L'APC demande un
 * comportement qu'on peut voir et évaluer sur critères.
 */
export const VERBES_PASSIFS = [
  "connaître",
  "comprendre",
  "savoir",
  "apprendre",
  "découvrir",
  "être sensibilisé",
  "prendre connaissance",
  "assimiler",
  "maîtriser",
] as const;

/**
 * Rapproche deux libellés de méthode.
 *
 * Le modèle n'écrit jamais deux fois exactement la même chose — « Travail en
 * sous-groupes » un jour, « travail en sous groupes (3 par table) » le
 * lendemain. Comparer les chaînes brutes ferait passer la seconde pour une
 * méthode neuve, et la règle de variété ne servirait à rien.
 */
export function normaliserMethode(libelle: string): string {
  return libelle
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Vrai quand deux méthodes sont la même à la formulation près.
 *
 * Le test se fait par inclusion et non par égalité : « travail en sous groupes
 * par table de trois » contient « travail en sous groupes », c'est la même
 * méthode habillée.
 */
export function memeMethode(a: string, b: string): boolean {
  const x = normaliserMethode(a);
  const y = normaliserMethode(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

/**
 * Les méthodes actives citées par une fiche déjà enregistrée.
 *
 * Deux formes coexistent : `methodeActive`, posée en tête depuis cette
 * version, et les `strategie` du développement, seul endroit où la méthode
 * apparaissait auparavant. Lire les deux évite que la règle de variété
 * reparte de zéro sur l'historique déjà en base.
 */
export function methodesDeLaFiche(contenu: string): string[] {
  let brut: Record<string, unknown>;
  try {
    brut = JSON.parse(contenu) as Record<string, unknown>;
  } catch {
    return [];
  }

  const trouvees: string[] = [];
  const tete = brut.methodeActive;
  if (typeof tete === "string" && tete.trim()) trouvees.push(nomSeul(tete));

  for (const l of Array.isArray(brut.developpement) ? brut.developpement : []) {
    const st = (l as { strategie?: unknown })?.strategie;
    if (typeof st === "string" && st.trim()) trouvees.push(nomSeul(st));
  }
  return trouvees.filter(Boolean);
}

/**
 * Le nom de la méthode, débarrassé de son explication.
 *
 * Le modèle écrit volontiers « Analyse critique de production : les stagiaires
 * examinent une note existante et… » — trois lignes là où on attend trois
 * mots. Reversées telles quelles dans le prompt de la séance suivante, ces
 * tirades noieraient la liste des méthodes à éviter.
 */
function nomSeul(libelle: string): string {
  return libelle.split(/[:.(\n]/)[0]!.trim().slice(0, 60);
}
