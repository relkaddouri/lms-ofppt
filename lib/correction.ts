/**
 * Proposition de correction d'un travail pratique (PRD §4.4).
 *
 * Ce n'est pas un corrigé au sens strict — un TP de conception n'a pas de
 * réponse unique. C'est ce qu'on attend à chaque étape, les erreurs qu'on
 * verra revenir, et comment attribuer les points du barème que l'énoncé
 * annonce déjà : de quoi corriger vingt copies sans réinventer sa grille à
 * chaque fois.
 */

export type EtapeCorrigee = {
  /** La consigne de l'énoncé à laquelle cette étape répond. */
  consigne: string;
  /** Ce qu'une production correcte montre à cette étape. */
  attendu: string[];
  /** Ce qui revient le plus souvent, et comment le reprendre. */
  erreurs: string[];
};

export type CritereNote = {
  critere: string;
  points: number;
  /** Ce qui vaut le total, et ce qui coûte des points. */
  bareme: string;
};

export type CorrectionTp = {
  /** Une production complète, décrite : la référence à laquelle comparer. */
  proposition: string;
  etapes: EtapeCorrigee[];
  criteres: CritereNote[];
  /** Ce qu'il faut reprendre avec le groupe entier après la correction. */
  aReprendre: string[];
  /**
   * Grille rédigée à la main, en markdown (PRD §4.4).
   *
   * Renseignée, elle remplace la grille structurée — pas de fusion des deux :
   * un formateur qui écrit sa propre grille ne veut pas la voir cohabiter avec
   * une proposition du modèle qu'il a justement écartée. Le rendu passe par le
   * même moteur que les supports, donc la même typographie.
   */
  markdown?: string | null;
};

export function correctionVide(): CorrectionTp {
  return { proposition: "", etapes: [], criteres: [], aReprendre: [] };
}

/** Vrai si la correction est rédigée à la main plutôt que structurée. */
export function estRedigee(correction: CorrectionTp): boolean {
  return (
    typeof correction.markdown === "string" && correction.markdown.trim() !== ""
  );
}

/**
 * Relit une correction enregistrée sans jamais renvoyer une forme partielle.
 *
 * L'écran d'affichage n'a pas à tester chaque tableau : une correction lue
 * est toujours complète, quitte à être vide.
 */
export function lireCorrection(contenu: unknown): CorrectionTp {
  const brut = (contenu ?? {}) as Record<string, unknown>;
  return {
    proposition: String(brut.proposition ?? "").trim(),
    etapes: (Array.isArray(brut.etapes) ? brut.etapes : []).map((e) => {
      const o = (e ?? {}) as Record<string, unknown>;
      return {
        consigne: String(o.consigne ?? "").trim(),
        attendu: lignes(o.attendu),
        erreurs: lignes(o.erreurs),
      };
    }),
    criteres: (Array.isArray(brut.criteres) ? brut.criteres : []).map((c) => {
      const o = (c ?? {}) as Record<string, unknown>;
      return {
        critere: String(o.critere ?? "").trim(),
        points: Math.max(0, Number(o.points) || 0),
        bareme: String(o.bareme ?? "").trim(),
      };
    }),
    aReprendre: lignes(brut.aReprendre, 8),
    markdown:
      typeof brut.markdown === "string" && brut.markdown.trim()
        ? brut.markdown
        : null,
  };
}

function lignes(v: unknown, max = 10): string[] {
  const brut = Array.isArray(v) ? v : typeof v === "string" ? v.split("\n") : [];
  return brut
    .map((l) => String(l ?? "").replace(/^\s*[-–•*]\s*|^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, max);
}
