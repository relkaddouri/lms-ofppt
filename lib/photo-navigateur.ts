/**
 * Préparer une photo dans le navigateur avant de la déposer (PRD §4.5).
 *
 * Le dépôt refusait tout ce qui n'était pas un JPEG, PNG ou WebP de moins de
 * deux mégaoctets — et le sélecteur de fichiers n'affichait même pas le
 * reste. C'est exactement ce qu'un stagiaire a dans la main : un iPhone
 * produit du HEIC, un Android du JPEG de quatre mégaoctets, et aucun des deux
 * ne propose de redimensionner avant d'envoyer. Le trombinoscope est donc
 * resté vide : aucune photo n'a jamais été déposée, ni par les stagiaires ni
 * par le formateur.
 *
 * Le navigateur sait faire ce travail. On décode, on redimensionne, on
 * réencode en JPEG : le portrait arrive à quelques dizaines de kilooctets,
 * dans un format que le stockage accepte, sans rien demander à personne.
 *
 * Ce fichier ne s'exécute que côté navigateur — `createImageBitmap`, `canvas`
 * et `URL.createObjectURL` n'existent pas ailleurs. Il est séparé de
 * `lib/photos.ts`, que le rendu serveur importe pour les URL publiques.
 */

/** Le plus grand côté après réduction. Un avatar ne dépasse jamais 96 px à l'écran ; 1024 laisse de la marge pour les écrans à forte densité et les usages futurs (une fiche imprimée, un trombinoscope). */
const COTE_MAX = 1024;

/** Qualités tentées successivement tant que le fichier reste trop lourd. */
const QUALITES = [0.85, 0.7, 0.55];

/** La limite du bucket. Dépasser, c'est un refus côté stockage. */
const POIDS_MAX = 2 * 1024 * 1024;

/**
 * Décode l'image, quel que soit son format d'origine.
 *
 * `createImageBitmap` d'abord : il décode le HEIC là où le système le sait
 * (Safari), applique l'orientation EXIF, et travaille hors du fil principal.
 * L'élément `<img>` ensuite, pour les navigateurs qui ne l'implémentent pas
 * encore sur les blobs.
 */
async function decoder(fichier: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      // `from-image` : sans lui, un portrait pris en tenant le téléphone
      // debout ressort couché — l'orientation vit dans l'EXIF, que le canvas
      // ignore.
      return await createImageBitmap(fichier, {
        imageOrientation: "from-image",
      });
    } catch {
      // Format que le système ne sait pas décoder : on tente l'élément image,
      // qui échouera plus explicitement.
    }
  }

  const adresse = URL.createObjectURL(fichier);
  try {
    return await new Promise<HTMLImageElement>((resoudre, rejeter) => {
      const image = new Image();
      image.onload = () => resoudre(image);
      image.onerror = () =>
        rejeter(new Error("Image illisible par ce navigateur."));
      image.src = adresse;
    });
  } finally {
    URL.revokeObjectURL(adresse);
  }
}

export type PhotoPreparee = {
  fichier: File;
  /** Pour l'aperçu immédiat, sans attendre l'aller-retour du stockage. */
  apercu: string;
};

/**
 * Réduit et réencode une photo en JPEG déposable.
 *
 * Rejette avec un message lisible quand le fichier n'est pas une image que ce
 * navigateur sait ouvrir — le seul cas qu'il reste à refuser.
 */
export async function preparerPhoto(fichier: File): Promise<PhotoPreparee> {
  const source = await decoder(fichier);
  const largeurSource =
    source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const hauteurSource =
    source instanceof HTMLImageElement ? source.naturalHeight : source.height;

  if (!largeurSource || !hauteurSource) {
    throw new Error("Image illisible par ce navigateur.");
  }

  // On ne grossit jamais : une petite photo reste petite, elle est simplement
  // réencodée.
  const facteur = Math.min(
    1,
    COTE_MAX / Math.max(largeurSource, hauteurSource),
  );
  const largeur = Math.round(largeurSource * facteur);
  const hauteur = Math.round(hauteurSource * facteur);

  const toile = document.createElement("canvas");
  toile.width = largeur;
  toile.height = hauteur;
  const ctx = toile.getContext("2d");
  if (!ctx) throw new Error("Ce navigateur ne sait pas préparer l'image.");
  // Le JPEG n'a pas de transparence : sans ce fond, un PNG transparent
  // ressortirait sur du noir.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, largeur, hauteur);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, largeur, hauteur);
  if ("close" in source) source.close();

  let blob: Blob | null = null;
  for (const qualite of QUALITES) {
    blob = await new Promise<Blob | null>((r) =>
      toile.toBlob(r, "image/jpeg", qualite),
    );
    if (blob && blob.size <= POIDS_MAX) break;
  }
  if (!blob) throw new Error("La conversion de l'image a échoué.");
  if (blob.size > POIDS_MAX) {
    throw new Error("Cette image reste trop lourde après réduction.");
  }

  return {
    fichier: new File([blob], "photo.jpg", { type: "image/jpeg" }),
    apercu: toile.toDataURL("image/jpeg", 0.7),
  };
}
