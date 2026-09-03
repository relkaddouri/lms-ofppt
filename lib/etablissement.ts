/**
 * Limites de l'identité d'établissement, hors fichier « use server ».
 *
 * Une constante exportée depuis un fichier `"use server"` fait échouer le
 * rendu — Next n'y accepte que des fonctions asynchrones — et l'écran devient
 * blanc. Elle vit donc ici, où le serveur comme le client peuvent la lire.
 */

/** Un logo plus lourd traverserait chaque export sans rien apporter de plus. */
export const LOGO_TAILLE_MAX = 300 * 1024;

/** Ce qu'accepte jsPDF à l'impression : ni SVG, ni WebP. */
export const LOGO_TYPES = ["image/png", "image/jpeg"] as const;

/**
 * Année scolaire en cours, au format du document officiel.
 *
 * Elle bascule en septembre, pas en janvier : un tableau de service rédigé en
 * octobre 2026 porte « 2026/2027 ». Ce n'est qu'une proposition de saisie —
 * on rédige aussi bien avant la rentrée qu'en cours d'année, donc la valeur
 * reste modifiable.
 */
export function anneeScolaireCourante(reference = new Date()): string {
  const an = reference.getFullYear();
  const debut = reference.getMonth() >= 8 ? an : an - 1;
  return `${debut}/${debut + 1}`;
}
