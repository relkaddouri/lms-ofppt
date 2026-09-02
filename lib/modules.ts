/**
 * Un module se désigne par son code, pas par son intitulé.
 *
 * Les intitulés du référentiel font jusqu'à soixante caractères — « Connaître
 * les spécificités de l'ergonomie de différents types de solutions
 * digitales ». Le formateur, lui, dit « M204 ». Partout où un module est
 * nommé, le code passe donc devant.
 */
export function libelleModule(
  code: string | null | undefined,
  nom: string | null | undefined,
): string {
  const intitule = nom?.trim() || "Module";
  return code ? `${code} — ${intitule}` : intitule;
}

/** Cycle de formation d'une compétence, tel que la base le stocke. */
export type CycleModule = "tronc_commun" | "specialisation" | null;

/** L'année de formation correspondante : 1 pour le tronc commun, 2 sinon. */
export function anneeDuCycle(cycle: CycleModule): 1 | 2 | null {
  if (cycle === "tronc_commun") return 1;
  if (cycle === "specialisation") return 2;
  return null;
}

export function libelleAnnee(annee: number): string {
  return annee === 1 ? "1ʳᵉ année" : `${annee}ᵉ année`;
}
