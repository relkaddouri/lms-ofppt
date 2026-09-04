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
 * Les mêmes couleurs en composantes, pour les documents PDF.
 *
 * jsPDF ne sait pas lire une variable CSS : les valeurs sont donc écrites deux
 * fois, ici et dans `globals.css`. Elles doivent le rester à l'identique — un
 * groupe qui change de couleur entre l'écran et le document imprimé perdrait
 * ce que la couleur sert à établir.
 */
export const COULEURS_GROUPE_RVB: {
  fond: [number, number, number];
  trait: [number, number, number];
}[] = [
  { fond: [234, 235, 237], trait: [46, 59, 78] },
  { fond: [230, 239, 243], trait: [36, 95, 121] },
  { fond: [232, 241, 235], trait: [44, 108, 70] },
  { fond: [237, 233, 245], trait: [91, 75, 138] },
  { fond: [251, 240, 221], trait: [138, 100, 22] },
  { fond: [242, 244, 247], trait: [63, 78, 98] },
];

/** Rang d'un groupe dans la palette, de 0 à 5. */
export function rangGroupe(id: string): number {
  let somme = 0;
  for (let i = 0; i < id.length; i++) {
    somme = (somme * 31 + id.charCodeAt(i)) >>> 0;
  }
  return somme % COULEURS_GROUPE.length;
}

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
  return COULEURS_GROUPE[rangGroupe(id)];
}
