import type jsPDF from "jspdf";
import { COULEURS, police } from "@/lib/pdf-theme";
import { segmenter, type Segment } from "@/lib/markdown";

/**
 * Dessine du markdown dans un PDF avec la typographie du produit (PRD §4.4).
 *
 * Pendant du rendu écran de `components/TexteMarkdown` : « la source de la
 * rédaction ne doit jamais se voir dans le résultat ». Une section écrite à la
 * main doit sortir de l'imprimante comme une section générée — mêmes polices,
 * mêmes gris, mêmes retraits.
 *
 * Ce que ce moteur couvre : titres, paragraphes, listes à puces et numérotées,
 * citations, filets, code, et le gras, l'italique et le code en ligne. Ce
 * qu'il ne couvre pas, faute de sens sur du papier ou faute de support de
 * jsPDF : les images, les tableaux et les liens cliquables — une URL s'imprime
 * alors en toutes lettres, ce qui est la seule forme utilisable sur papier.
 * La liste est explicite pour que le trou se voie plutôt que de surprendre.
 */

export type CadreMarkdown = {
  /** Abscisse du bord gauche du texte. */
  x: number;
  largeur: number;
  /** Ordonnée de la première ligne. */
  y: number;
  /** Appelée avant d'écrire : doit réserver la hauteur et rendre l'ordonnée. */
  place: (hauteur: number) => number;
};

/**
 * Dessine le markdown et renvoie l'ordonnée atteinte.
 *
 * `place` reste à l'appelant : c'est lui qui sait où sont ses marges, quand
 * changer de page et quel en-tête reposer. Ce moteur ne fait que du texte.
 */
export function dessinerMarkdown(
  doc: jsPDF,
  markdown: string,
  cadre: CadreMarkdown,
): number {
  let y = cadre.y;

  const ecrireSegments = (
    segments: Segment[],
    taille: number,
    indent: number,
    couleur: readonly [number, number, number],
    interligne: number,
  ) => {
    // Le retour à la ligne se calcule sur le texte nu, puis chaque ligne est
    // repeinte segment par segment : mesurer en gras ce qui sera écrit en
    // maigre décalerait tout.
    const nu = segments.map((s) => s.texte).join("");
    const lignes: string[] = doc.splitTextToSize(nu, cadre.largeur - indent);

    let consomme = 0;
    for (const ligne of lignes) {
      y = cadre.place(interligne);
      let x = cadre.x + indent;
      let restant = ligne.length;
      let curseur = consomme;

      while (restant > 0) {
        // Segment auquel appartient le caractère courant.
        let cumul = 0;
        const seg = segments.find((s) => {
          cumul += s.texte.length;
          return curseur < cumul;
        });
        if (!seg) break;
        const debutSeg = cumul - seg.texte.length;
        const dispo = Math.min(restant, cumul - curseur);
        const morceau = seg.texte.slice(curseur - debutSeg, curseur - debutSeg + dispo);

        police(doc, seg.code ? "mono" : seg.gras ? "corpsGras" : "corps", taille);
        doc.setTextColor(...(seg.code ? COULEURS.ardoise : couleur));
        doc.text(morceau, x, y);
        x += doc.getTextWidth(morceau);

        curseur += dispo;
        restant -= dispo;
      }
      // `splitTextToSize` mange l'espace de coupure : on le repasse.
      consomme = curseur + (curseur < nu.length && nu[curseur] === " " ? 1 : 0);
    }
  };

  const blocs = markdown.replace(/\r\n/g, "\n").split("\n");

  for (let i = 0; i < blocs.length; i++) {
    const ligne = blocs[i]!;
    const nue = ligne.trim();

    if (!nue) {
      y += 2;
      continue;
    }

    // ── Filet ──
    if (/^(?:---|\*\*\*|___)$/.test(nue)) {
      y = cadre.place(5);
      doc.setDrawColor(...COULEURS.separateur);
      doc.setLineWidth(0.3);
      doc.line(cadre.x, y - 1.5, cadre.x + cadre.largeur, y - 1.5);
      y += 1;
      continue;
    }

    // ── Titres ──
    const titre = nue.match(/^(#{1,6})\s+(.*)$/);
    if (titre) {
      const niveau = titre[1]!.length;
      const taille = niveau === 1 ? 12.5 : niveau === 2 ? 11 : 10;
      y += 3;
      const segments = segmenter(titre[2]!);
      const nu = segments.map((s) => s.texte).join("");
      police(doc, "titre", taille);
      doc.setTextColor(...COULEURS.encre);
      for (const l of doc.splitTextToSize(nu, cadre.largeur)) {
        y = cadre.place(taille * 0.55);
        doc.text(l, cadre.x, y);
      }
      y += 1.5;
      continue;
    }

    // ── Citation ──
    const citation = nue.match(/^>\s?(.*)$/);
    if (citation) {
      const avant = y;
      ecrireSegments(segmenter(citation[1]!), 9.5, 5, COULEURS.corps, 4.6);
      doc.setDrawColor(...COULEURS.bordureForte);
      doc.setLineWidth(0.8);
      doc.line(cadre.x + 1, avant - 3, cadre.x + 1, y + 1);
      continue;
    }

    // ── Listes ──
    const puce = nue.match(/^[-*+]\s+(.*)$/);
    const numero = nue.match(/^(\d+)\.\s+(.*)$/);
    if (puce || numero) {
      const marque = puce ? "•" : `${numero![1]}.`;
      const contenu = puce ? puce[1]! : numero![2]!;
      const avant = y;
      ecrireSegments(segmenter(contenu), 9.5, 9, COULEURS.corps, 4.5);
      police(doc, "corps", 9.5);
      doc.setTextColor(...COULEURS.ardoise);
      doc.text(marque, cadre.x + 3, avant + (y > avant ? 4.5 : 0));
      continue;
    }

    // ── Paragraphe ──
    ecrireSegments(segmenter(nue), 9.5, 0, COULEURS.corps, 4.6);
    y += 1;
  }

  return y;
}
