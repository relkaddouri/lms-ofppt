import type jsPDF from "jspdf";

/**
 * Identité de l'établissement en tête des documents produits.
 *
 * Un document remis à la Direction porte le nom et le logo du centre, pas le
 * seul sigle « OFPPT » qui était jusqu'ici écrit en dur. Les deux se règlent
 * depuis Paramètres : chaque générateur de PDF reçoit la marque et la pose au
 * même endroit, en haut à gauche, plutôt que de la redessiner à sa façon.
 */
export type Marque = { etablissement: string | null; logo: string | null };

/** Ce que voit un document quand rien n'a été réglé. */
export const MARQUE_VIDE: Marque = { etablissement: null, logo: null };

/**
 * Traduit ce que renvoie `getEtablissement` en marque de document.
 *
 * Les deux formes disent la même chose, mais le réglage se lit « nom du
 * centre » dans Paramètres alors qu'un PDF parle d'établissement : la
 * conversion tient ici plutôt que répétée à chaque export.
 */
export function marqueDe(reglage: {
  nom: string | null;
  logo: string | null;
}): Marque {
  return { etablissement: reglage.nom, logo: reglage.logo };
}

const GRIS: [number, number, number] = [107, 114, 128];

/** Le sigle reste le repli : un document sans en-tête d'aucune sorte serait pire. */
export function nomEtablissement(marque?: Marque | null): string {
  return marque?.etablissement?.trim() || "OFPPT";
}

/**
 * Pose le logo et renvoie la largeur qu'il occupe, 0 s'il n'y en a pas.
 *
 * La hauteur est imposée, la largeur suit les proportions de l'image : un logo
 * carré et un logo en bandeau doivent tous deux tenir dans l'en-tête sans
 * l'écraser. Une image illisible n'interrompt pas l'export — le document sort
 * sans logo plutôt que pas du tout.
 */
export function dessinerLogo(
  doc: jsPDF,
  marque: Marque | null | undefined,
  x: number,
  y: number,
  hauteur: number,
  largeurMax: number,
): number {
  if (!marque?.logo) return 0;
  try {
    const props = doc.getImageProperties(marque.logo);
    const ratio = props.width / props.height;
    const largeur = Math.min(hauteur * ratio, largeurMax);
    const format = props.fileType === "JPEG" ? "JPEG" : "PNG";
    doc.addImage(marque.logo, format, x, y, largeur, largeur / ratio);
    return largeur;
  } catch {
    return 0;
  }
}

/**
 * Bandeau d'identité complet : logo à gauche, nom du centre à sa droite.
 * Renvoie l'ordonnée juste sous le bandeau, prête pour la suite du document.
 */
export function dessinerEntete(
  doc: jsPDF,
  marque: Marque | null | undefined,
  x: number,
  y: number,
  largeur: number,
  hauteurLogo = 11,
): number {
  const largeurLogo = dessinerLogo(doc, marque, x, y, hauteurLogo, largeur * 0.45);
  const decalage = largeurLogo > 0 ? largeurLogo + 5 : 0;

  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...GRIS);
  const lignes = doc.splitTextToSize(
    nomEtablissement(marque),
    largeur - decalage,
  ) as string[];
  // Le nom se centre sur la hauteur du logo : côte à côte, un texte aligné en
  // haut paraîtrait décroché de l'image.
  const hauteurTexte = lignes.length * 4;
  const hautTexte =
    largeurLogo > 0 ? y + (hauteurLogo - hauteurTexte) / 2 + 3.2 : y + 3.2;
  doc.text(lignes, x + decalage, hautTexte);

  return y + Math.max(largeurLogo > 0 ? hauteurLogo : 0, hauteurTexte) + 5;
}
