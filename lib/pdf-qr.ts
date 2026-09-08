import type jsPDF from "jspdf";
import qrcode from "qrcode-generator";
import { COULEURS } from "@/lib/pdf-theme";

/**
 * Un QR code dessiné en vectoriel dans un document.
 *
 * Vectoriel et non en image : un PNG posé dans un PDF se pixellise dès qu'on
 * imprime en 600 points par pouce, et un QR flou ne se lit plus. Des
 * rectangles restent nets à toutes les résolutions et pèsent moins lourd.
 *
 * Les modules noirs d'une même ligne sont fusionnés en un seul rectangle :
 * un QR de 37 modules de côté en compte 1 369, et les dessiner un par un
 * gonfle le fichier sans rien apporter.
 *
 * La zone de silence — les quatre modules blancs qui entourent le code — n'est
 * pas dessinée : elle est à la charge de la mise en page, qui doit garder cet
 * espace libre autour. Sans elle, aucun lecteur ne décode.
 */
/**
 * Encode le texte en UTF-8 avant de le passer au générateur.
 *
 * La bibliothèque encode en Latin-1 par défaut : un « é » ressortait alors en
 * caractère de remplacement sur le téléphone qui scanne. Elle embarque bien un
 * encodeur UTF-8, mais son build ESM ne l'expose pas — `stringToBytesFuncs` y
 * est vide. Une ligne de `TextEncoder` fait le même travail sans dépendre de
 * la façon dont le paquet est empaqueté.
 */
function encoder(): void {
  qrcode.stringToBytes = (s: string) =>
    Array.from(new TextEncoder().encode(s));
}

/** Construit le code une fois, pour le mesurer puis le dessiner. */
function construire(texte: string) {
  encoder();
  const code = qrcode(0, "M");
  code.addData(texte);
  code.make();
  return code;
}

export function dessinerQr(
  doc: jsPDF,
  texte: string,
  x: number,
  y: number,
  taille: number,
): void {
  const code = construire(texte);

  const n = code.getModuleCount();
  const pas = taille / n;
  doc.setFillColor(...COULEURS.encre);

  for (let ligne = 0; ligne < n; ligne++) {
    let debut = -1;
    for (let colonne = 0; colonne <= n; colonne++) {
      const noir = colonne < n && code.isDark(ligne, colonne);
      if (noir && debut === -1) debut = colonne;
      if (!noir && debut !== -1) {
        doc.rect(
          x + debut * pas,
          y + ligne * pas,
          (colonne - debut) * pas,
          pas,
          "F",
        );
        debut = -1;
      }
    }
  }
}

/** Le nombre de modules d'un côté, pour dimensionner le carré. */
export function tailleQr(texte: string): number {
  return construire(texte).getModuleCount();
}
