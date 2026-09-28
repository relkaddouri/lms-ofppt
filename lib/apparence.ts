/**
 * Clair, sombre, ou comme le système.
 *
 * Partagé entre la bascule et le script d'amorçage du gabarit racine : les
 * deux doivent connaître la même clé et les mêmes valeurs, faute de quoi la
 * page s'ouvrirait dans un thème et basculerait dans l'autre à l'hydratation.
 */
export const CLE_APPARENCE = "pedago:apparence";

export type Apparence = "clair" | "sombre" | "systeme";

/**
 * Pose le choix sur la racine du document.
 *
 * « Système » ne pose rien : c'est l'absence d'attribut qui laisse la requête
 * média décider, et c'est aussi ce qui permet à l'affichage de suivre quand
 * le téléphone passe de lui-même en sombre le soir.
 */
export function appliquerApparence(apparence: Apparence): void {
  const racine = document.documentElement;
  if (apparence === "systeme") racine.removeAttribute("data-theme");
  else racine.setAttribute("data-theme", apparence === "sombre" ? "dark" : "light");
}
