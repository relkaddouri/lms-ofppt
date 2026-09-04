/**
 * Les deux documents d'un module (PRD §4.4).
 *
 * Le PRD les sépare explicitement : « Support du cours », compilation du
 * contenu théorique dans l'ordre des séances, et « Pratique de [Module] »,
 * qui regroupe les travaux pratiques. Ce ne sont pas deux vues d'un même
 * document : un stagiaire révise avec l'un et travaille avec l'autre.
 */

export type PieceDocument = {
  seanceId: string;
  /**
   * Combien de séances cette pièce recouvre.
   *
   * Un document de module compte une entrée par **contenu**, pas par séance.
   * Deux groupes parallèles suivent le même cours, et un objectif étalé sur
   * plusieurs créneaux reste un seul chapitre : sans ce regroupement, M104
   * affichait « Appréhender la gestion de projet UX/UI » quatre fois — deux
   * groupes × deux créneaux.
   */
  seances: number;
  /** Ordre de lecture : la date de la séance, ou son rang à défaut. */
  date: string | null;
  titre: string;
  objectif: string | null;
  /** Vrai quand un support est enregistré pour cette séance. */
  redigee: boolean;
  faite: boolean;
  /** TP seulement : une grille de correction est enregistrée. */
  corrigee?: boolean;
};

export type DocumentModule = {
  genre: "cours" | "pratique";
  titre: string;
  pieces: PieceDocument[];
};

/** Le titre du document, tel qu'il s'affiche et s'imprime. */
export function titreDocument(
  genre: "cours" | "pratique",
  moduleNom: string,
): string {
  return genre === "pratique"
    ? `Pratique de ${moduleNom}`
    : `Support du cours — ${moduleNom}`;
}

/** Combien de pièces sont réellement rédigées, sur le total attendu. */
export function avancement(doc: DocumentModule): {
  redigees: number;
  total: number;
} {
  return {
    redigees: doc.pieces.filter((p) => p.redigee).length,
    total: doc.pieces.length,
  };
}

/**
 * La clé qui identifie un contenu, indépendamment de la séance qui le porte.
 *
 * Deux composantes seulement : l'objectif du référentiel, et la nature — un
 * cours et son TP sont deux documents distincts.
 *
 * Les **éléments de contenu n'entrent pas dans la clé**, alors qu'ils y
 * semblaient à leur place. Le remplissage des créneaux (§4.9) coupe la
 * séquence pédagogique là où le créneau se termine, pas là où l'objectif
 * change : deux séances d'un même objectif peuvent donc porter des ensembles
 * d'éléments différents sans couvrir des contenus différents. Les garder dans
 * la clé rouvrait la duplication qu'on cherche à fermer — sur M104, B.1, B.2,
 * C.1 et C.2 apparaissaient encore deux fois chacun.
 *
 * Un chapitre de document est donc un objectif, ce qui est aussi ce qu'un
 * lecteur attend d'un sommaire.
 */
export function cleContenu(s: {
  objectifCode: string | null;
  objectifLibelle: string | null;
  nature: string | null;
}): string {
  return [
    s.objectifCode ?? s.objectifLibelle ?? "?",
    s.nature ?? "theorique",
  ].join("|");
}

/**
 * Regroupe des séances par contenu, en gardant l'ordre d'apparition.
 *
 * La première séance d'un groupe donne sa date et son identifiant à la pièce :
 * c'est celle par laquelle le contenu entre dans le programme.
 */
export function grouperParContenu<T>(
  seances: T[],
  cle: (s: T) => string,
): T[][] {
  const paquets = new Map<string, T[]>();
  for (const s of seances) {
    const k = cle(s);
    const existant = paquets.get(k);
    if (existant) existant.push(s);
    else paquets.set(k, [s]);
  }
  return [...paquets.values()];
}
