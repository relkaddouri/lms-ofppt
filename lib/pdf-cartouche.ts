import type jsPDF from "jspdf";
import { dessinerLogo, type Marque } from "@/lib/pdf-marque";
import { COULEURS, police } from "@/lib/pdf-theme";
import { insecable } from "@/lib/typographie";
import type { Identification } from "@/lib/resultat";

/**
 * L'en-tête et le cartouche d'identification des documents d'évaluation.
 *
 * Le résultat à signer et la feuille d'émargement sont deux pièces d'un même
 * dossier : elles annoncent la même épreuve, dans le même centre, pour le même
 * groupe. Les dessiner deux fois aurait suffi à les laisser diverger — un
 * champ ajouté ici, oublié là — alors que l'administration les reçoit
 * agrafées l'une à l'autre.
 */

export const X = 16;
export const LARGEUR = 178;

export type EnteteDocument = {
  /** « Résultat d'évaluation », « Feuille d'émargement »… */
  titre: string;
  /** « Contrôle continu » ou « Épreuve de fin de module ». */
  nature: string;
  /** L'intitulé de l'épreuve, en clair dans le cartouche. */
  epreuve: string;
  /** La ligne discrète sous la nature — « Publié le 08/09/2026 ». */
  mention?: string | null;
  identification: Identification;
};

/** Dessine l'en-tête et le cartouche. Rend l'ordonnée juste en dessous. */
export function dessinerCartouche(
  doc: jsPDF,
  entete: EnteteDocument,
  marque?: Marque,
): number {
  // ── En-tête : le logo seul ───────────────────────────────────────────────
  //
  // Le nom du centre n'est plus posé à côté du logo : il le répétait presque
  // mot pour mot, et les deux se disputaient la largeur. Il descend dans le
  // cartouche, où il est une donnée du document parmi les autres.
  const largeurLogo = dessinerLogo(doc, marque, X, 13, 13, LARGEUR * 0.4);

  police(doc, "titre", 17);
  doc.setTextColor(...COULEURS.encre);
  doc.text(entete.titre, X + (largeurLogo > 0 ? largeurLogo + 7 : 0), 22);

  police(doc, "mono", 8);
  doc.setTextColor(...COULEURS.ardoiseClaire);
  doc.text(entete.nature.toLocaleUpperCase("fr"), X + LARGEUR, 17, { align: "right" });
  police(doc, "corps", 8.5);
  doc.setTextColor(...COULEURS.ardoise);
  if (entete.mention) {
    doc.text(entete.mention, X + LARGEUR, 22, { align: "right" });
  }

  let y = 32;

  // ── Cartouche d'identification ───────────────────────────────────────────
  //
  // Un tableau à filets plutôt qu'une ligne de texte gris : c'est la forme
  // qu'ont les documents de l'établissement, et surtout la seule qui se
  // parcoure du regard quand on cherche un champ précis.
  const id = entete.identification;
  const rangs: [string, string | null | undefined][][] = [
    [["ÉTABLISSEMENT", id.etablissement]],
    [
      ["FILIÈRE", id.filiere],
      ["ANNÉE SCOLAIRE", id.anneeScolaire],
    ],
    [
      ["GROUPE", id.groupe],
      ["FORMATEUR", [id.formateur, id.matricule && `mat. ${id.matricule}`]
        .filter(Boolean)
        .join(" · ") || null],
    ],
    [["MODULE", id.module]],
    [["ÉPREUVE", entete.epreuve]],
    [
      ["DATE", id.dateEpreuve],
      ["HORAIRE", id.horaire],
    ],
  ];

  const retenus = rangs
    .map((rang) => rang.filter(([, valeur]) => valeur?.trim()))
    .filter((rang) => rang.length > 0);

  if (retenus.length > 0) {
    const LARGEUR_ETIQUETTE = 30;
    const hautCartouche = y;

    retenus.forEach((rang, i) => {
      const colonne = LARGEUR / rang.length;
      const place = colonne - LARGEUR_ETIQUETTE - 6;

      // La hauteur du rang suit son contenu. Fixée à une ligne, elle coupait
      // « Digital Design, option UX Design · 2e année » au milieu du mot — sur
      // un cartouche d'identification, une valeur tronquée ne vaut rien.
      police(doc, "corps", 8.8);
      const cellules = rang.map(([etiquette, valeur]) => ({
        etiquette,
        lignes: doc.splitTextToSize(insecable(valeur!.trim()), place) as string[],
      }));
      const hauteur = Math.max(
        8,
        ...cellules.map((c) => c.lignes.length * 4.2 + 3.6),
      );

      if (i > 0) {
        doc.setDrawColor(...COULEURS.bordure).setLineWidth(0.2);
        doc.line(X, y, X + LARGEUR, y);
      }
      cellules.forEach((cellule, k) => {
        const cx = X + k * colonne;
        if (k > 0) {
          doc.setDrawColor(...COULEURS.bordure).setLineWidth(0.2);
          doc.line(cx, y, cx, y + hauteur);
        }
        police(doc, "mono", 6.8);
        doc.setTextColor(...COULEURS.ardoiseClaire);
        doc.text(cellule.etiquette, cx + 3, y + 5.4);
        police(doc, "corps", 8.8);
        doc.setTextColor(...COULEURS.encre);
        cellule.lignes.forEach((ligne, l) =>
          doc.text(ligne, cx + LARGEUR_ETIQUETTE, y + 5.4 + l * 4.2),
        );
      });
      y += hauteur;
    });

    doc.setDrawColor(...COULEURS.bordureForte).setLineWidth(0.3);
    doc.rect(X, hautCartouche, LARGEUR, y - hautCartouche);
    y += 9;
  }


  return y;
}
