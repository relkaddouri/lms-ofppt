/**
 * Palette catégorielle par groupe (design_system.md §5.4).
 *
 * Elle distingue des groupes dans une grille — calendrier, emploi du temps —
 * et rien d'autre : jamais un statut, jamais une alerte. Le corail en est
 * exclu, sa présence devant rester rare et signifiante (§1) plutôt que diluée
 * en identifiant de groupe parmi d'autres.
 */

export type CouleurGroupe = { fond: string; trait: string };

/** Six rangs ; au-delà la palette boucle, le rang 7 reprenant le rang 1. */
export const COULEURS_GROUPE: CouleurGroupe[] = [
  { fond: "var(--groupe-1-fond)", trait: "var(--groupe-1-trait)" },
  { fond: "var(--groupe-2-fond)", trait: "var(--groupe-2-trait)" },
  { fond: "var(--groupe-3-fond)", trait: "var(--groupe-3-trait)" },
  { fond: "var(--groupe-4-fond)", trait: "var(--groupe-4-trait)" },
  { fond: "var(--groupe-5-fond)", trait: "var(--groupe-5-trait)" },
  { fond: "var(--groupe-6-fond)", trait: "var(--groupe-6-trait)" },
];

/**
 * Couleur d'un groupe, déduite de son identifiant.
 *
 * Déterministe : un même groupe porte la même couleur d'une session à
 * l'autre et d'un écran à l'autre. Tirer au hasard à l'affichage
 * ferait permuter les couleurs à chaque rechargement, ce qui détruirait
 * précisément ce que la couleur sert à établir — une reconnaissance
 * immédiate.
 */
export function couleurGroupe(id: string): CouleurGroupe {
  let somme = 0;
  for (let i = 0; i < id.length; i++) {
    somme = (somme * 31 + id.charCodeAt(i)) >>> 0;
  }
  return COULEURS_GROUPE[somme % COULEURS_GROUPE.length];
}
