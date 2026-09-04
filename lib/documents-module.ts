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
  /** Ordre de lecture : la date de la séance, ou son rang à défaut. */
  date: string | null;
  titre: string;
  objectif: string | null;
  /** Vrai quand un support est enregistré pour cette séance. */
  redigee: boolean;
  faite: boolean;
  /** TP seulement : une correction est enregistrée. */
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
