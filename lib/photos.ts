/**
 * Les photos de stagiaire (PRD §4.5).
 *
 * Le chemin porte l'identifiant du stagiaire en premier segment — c'est lui
 * qui décide de l'accès, côté base comme côté stockage — et le fichier
 * s'appelle toujours `photo` : un remplacement écrase le précédent au lieu
 * d'accumuler des orphelins que rien ne viendrait nettoyer.
 */
export const BUCKET_PHOTOS = "photos-stagiaire";

/** Le chemin de la photo d'un stagiaire, extension comprise. */
export function cheminPhoto(stagiaireId: string, nomFichier: string): string {
  const extension = nomFichier.toLowerCase().endsWith(".png")
    ? "png"
    : nomFichier.toLowerCase().endsWith(".webp")
      ? "webp"
      : "jpg";
  return `${stagiaireId}/photo.${extension}`;
}

/**
 * L'adresse publique d'une photo.
 *
 * Le bucket est public en lecture : une photo s'affiche dans un fil que tout
 * le groupe consulte, et signer chaque URL coûterait une requête par visage.
 *
 * Le paramètre `v` force le navigateur à recharger après un remplacement.
 * Sans lui, le chemin ne changeant pas, l'ancienne photo resterait affichée
 * jusqu'à expiration du cache — c'est-à-dire longtemps.
 */
export function urlPhoto(chemin: string | null | undefined): string | null {
  if (!chemin) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/${BUCKET_PHOTOS}/${chemin}`;
}

/** Ce que le dépôt accepte, en accord avec le bucket. */
export const TYPES_PHOTO = ["image/png", "image/jpeg", "image/webp"];
export const TAILLE_MAX_PHOTO = 2 * 1024 * 1024;
