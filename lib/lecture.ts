/**
 * La taille du texte suivi, réglable par le lecteur.
 *
 * Partagé entre le bouton A− / A+ et le script d'amorçage posé dans le
 * gabarit racine : les deux doivent connaître la même clé de stockage et la
 * même échelle, faute de quoi le texte sauterait d'une taille à l'autre entre
 * le premier affichage et l'hydratation.
 */
export const CLE_LECTURE = "pedago:lecture";

/**
 * Cinq crans, de « je lis vite » à « je lis de loin ».
 *
 * L'écart entre deux crans est d'environ 12 % : assez pour qu'on voie la
 * différence à l'appui, pas assez pour qu'un cran déborde la mise en page.
 */
export const TAILLES_LECTURE: number[] = [15, 17, 19, 21, 24];

/** Le cran du milieu-bas : confortable sans être démonstratif. */
export const TAILLE_LECTURE_DEFAUT = 17;

/** Pose la taille sur la racine du document ; tout le reste en découle. */
export function appliquerTailleLecture(taille: number): void {
  document.documentElement.style.setProperty("--lecture", `${taille}px`);
}
