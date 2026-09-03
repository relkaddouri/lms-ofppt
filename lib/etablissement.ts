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
