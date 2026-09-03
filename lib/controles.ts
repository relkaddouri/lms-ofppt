/**
 * Barème d'un contrôle — le total dépend du type (PRD §4.7).
 *
 * Un contrôle continu se barème sur 20 points, une épreuve de fin de module
 * sur 40 — le double, quelle que soit sa portée locale ou régionale. Le seuil
 * était écrit en dur à 20 partout, si bien qu'un EFM correctement barémé
 * ressortait comme faux et que l'invite de génération demandait au modèle de
 * totaliser la mauvaise valeur.
 */

export type TypeControleBareme = "CC" | "EFM";

export const BAREME_CC = 20;
export const BAREME_EFM = 40;

export function baremeAttendu(type: TypeControleBareme | null | undefined): number {
  return type === "EFM" ? BAREME_EFM : BAREME_CC;
}

/**
 * Le socle que toute la classe doit pouvoir atteindre : 60 % du total, soit
 * 12/20 pour un CC et 24/40 pour un EFM (§4.7). Il sert à calibrer la courbe
 * de difficulté, pas à valider une note.
 */
export function socleAccessible(type: TypeControleBareme | null | undefined): number {
  return baremeAttendu(type) * 0.6;
}

/**
 * Ramène une note à l'échelle sur 20, pour comparer ce qui ne se compare pas
 * autrement.
 *
 * Une moyenne qui additionnerait un 14/20 et un 31/40 sans les ramener à la
 * même échelle donnerait un chiffre faux. Chaque note reste affichée sur son
 * propre total ; seule la moyenne passe par ici.
 */
export function noteSur20(note: number, total: number): number {
  if (!(total > 0)) return 0;
  return (note * 20) / total;
}
