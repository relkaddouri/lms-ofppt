/**
 * L'identité publique du formateur (migration 106).
 *
 * Elle vit sur `profils` et non sur `parametres_formateur` : cette dernière
 * n'est lisible que par son propriétaire, et c'est bien aux stagiaires que
 * ce nom et ce visage s'adressent.
 *
 * Le chemin porte l'identifiant du compte en premier segment — c'est lui qui
 * décide de l'accès au stockage — et le fichier s'appelle toujours `photo` :
 * un remplacement écrase le précédent au lieu d'accumuler des orphelins.
 */
export const BUCKET_PHOTO_FORMATEUR = "photos-formateur";

/** Le chemin de la photo d'un formateur, extension comprise. */
export function cheminPhotoFormateur(userId: string, nomFichier: string): string {
  const bas = nomFichier.toLowerCase();
  const extension = bas.endsWith(".png")
    ? "png"
    : bas.endsWith(".webp")
      ? "webp"
      : "jpg";
  return `${userId}/photo.${extension}`;
}

/**
 * L'adresse publique d'une photo de formateur.
 *
 * Le bucket est public en lecture : ce visage s'affiche en tête de chaque
 * annonce d'un fil que tout le groupe consulte, et signer cette URL à chaque
 * rendu coûterait une requête pour rien.
 */
export function urlPhotoFormateur(chemin: string | null | undefined): string | null {
  if (!chemin) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/${BUCKET_PHOTO_FORMATEUR}/${chemin}`;
}

/** Ce que le dépôt accepte, en accord avec le bucket. */
export const TYPES_PHOTO_FORMATEUR = ["image/png", "image/jpeg", "image/webp"];
export const TAILLE_MAX_PHOTO_FORMATEUR = 2 * 1024 * 1024;

/** Le nom affiché, quand il en existe un. Sinon, la formule impersonnelle. */
export function nomAffiche(nom: string | null | undefined): string {
  return nom?.trim() || "Votre formateur";
}
