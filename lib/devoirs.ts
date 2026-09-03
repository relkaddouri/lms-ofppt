/**
 * Rendu de devoir sous forme de fichier — limites partagées serveur et client.
 *
 * Elles vivent ici, hors des fichiers « use server » qui n'exportent que des
 * fonctions asynchrones, pour que le formulaire de dépôt refuse un fichier
 * hors limites avant de le téléverser plutôt qu'après.
 */

export const BUCKET_RENDUS = "rendus-devoir";

/** 20 Mo : un rendu peut porter des maquettes, pas seulement du texte. */
export const RENDU_TAILLE_MAX = 20 * 1024 * 1024;

/** Miroir exact de la liste du bucket : la base refuserait le reste. */
export const RENDU_TYPES: readonly string[] = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/zip",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

export const RENDU_EXTENSIONS = ".pdf,.png,.jpg,.jpeg,.webp,.zip,.doc,.docx,.pptx";

/**
 * Chemin d'un rendu dans le bucket : les policies lisent le devoir au premier
 * segment et le stagiaire au second, l'ordre n'est donc pas décoratif.
 *
 * Le nom d'origine est assaini — un nom porteur de « / » créerait un segment
 * de plus et déplacerait le fichier hors de la portée des policies.
 */
export function cheminRendu(
  devoirId: string,
  stagiaireId: string,
  nomFichier: string,
): string {
  const propre =
    nomFichier
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(-80) || "rendu";
  return `${devoirId}/${stagiaireId}/${Date.now()}-${propre}`;
}

/** Taille lisible, pour annoncer un téléchargement avant de le lancer. */
export function tailleLisible(octets: number | null | undefined): string {
  if (!octets || octets < 0) return "";
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}
