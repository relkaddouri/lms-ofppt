import type jsPDF from "jspdf";
import { dessinerEntete, nomEtablissement, type Marque } from "@/lib/pdf-marque";
import {
  dessinerSupport,
  numeroterPages,
  BAS,
  ENCRE,
  GRIS,
  HAUT,
  LARGEUR,
  TRAIT,
  X,
} from "@/lib/pdf-support";
import type { Support } from "@/lib/support";

/**
 * Compilation d'un module en un seul document (PRD §4.4).
 *
 * « Le formateur doit pouvoir télécharger le support complet du module — la
 * compilation de toutes les séances dans l'ordre logique du programme, pas
 * seulement consulter un support séance par séance de façon fragmentée. »
 *
 * À ne pas confondre avec le classeur pédagogique (§4.13), qui compile les
 * **fiches de préparation** — les notes du formateur. Ici c'est le contenu
 * remis aux stagiaires : le cours d'un côté, les travaux pratiques de
 * l'autre, jamais mélangés.
 */

export type PieceCompilee = {
  /** Rang dans le module, tel qu'il s'imprime. */
  rang: number;
  date: string | null;
  /** Le code de l'objectif du référentiel, s'il est rattaché. */
  objectif: string | null;
  titre: string;
  support: Support;
};

export type CompilationModule = {
  genre: "cours" | "pratique";
  moduleNom: string;
  groupeNom: string;
  anneeScolaire: string | null;
  formateur: string | null;
  /** Date d'édition, déjà formatée. */
  edite: string;
  pieces: PieceCompilee[];
};

export async function construireCompilationPdf(
  c: CompilationModule,
  marque?: Marque,
): Promise<jsPDF> {
  const { default: JsPDF } = await import("jspdf");
  const doc = new JsPDF({ unit: "mm", format: "a4" });

  couverture(doc, c, marque);

  // Chaque séance ouvre sa page : un document qu'on imprime pour le distribuer
  // se feuillette par séance, et un chapitre qui commence au milieu d'une page
  // se retrouve agrafé au précédent.
  for (const piece of c.pieces) {
    doc.addPage();
    let y = HAUT;
    y = chapitre(doc, piece, y);
    dessinerSupport(
      doc,
      piece.support,
      {
        moduleNom: c.moduleNom,
        groupeNom: c.groupeNom,
        date: piece.date,
        dureeHeures: null,
        objectif: piece.objectif,
      },
      y,
    );
  }

  numeroterPages(doc, `${titreCompilation(c)} — ${c.groupeNom}`);
  return doc;
}

export function titreCompilation(c: CompilationModule): string {
  return c.genre === "pratique"
    ? `Pratique de ${c.moduleNom}`
    : `Support du cours — ${c.moduleNom}`;
}

/**
 * La page de garde.
 *
 * Elle porte l'identité de l'établissement comme les autres documents
 * officiels, et surtout le sommaire : c'est ce qui distingue une compilation
 * d'une pile de supports agrafés.
 */
function couverture(doc: jsPDF, c: CompilationModule, marque?: Marque) {
  let y = dessinerEntete(doc, marque, X, HAUT, LARGEUR);
  y += 14;

  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...GRIS);
  doc.text(
    c.genre === "pratique" ? "TRAVAUX PRATIQUES" : "SUPPORT DE COURS",
    X,
    y,
  );
  y += 10;

  doc.setFont("helvetica", "bold").setFontSize(19).setTextColor(...ENCRE);
  for (const l of doc.splitTextToSize(titreCompilation(c), LARGEUR)) {
    doc.text(l, X, y);
    y += 8.5;
  }

  y += 4;
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(...GRIS);
  const identite = [
    `Groupe : ${c.groupeNom}`,
    c.anneeScolaire ? `Année scolaire : ${c.anneeScolaire}` : null,
    c.formateur ? `Formateur : ${c.formateur}` : null,
    nomEtablissement(marque) ? `EFP : ${nomEtablissement(marque)}` : null,
    `Édité le ${c.edite}`,
  ].filter((l): l is string => l !== null);
  for (const l of identite) {
    doc.text(l, X, y);
    y += 5.2;
  }

  y += 8;
  doc.setDrawColor(...TRAIT).setLineWidth(0.3);
  doc.line(X, y, X + LARGEUR, y);
  y += 9;

  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...ENCRE);
  doc.text("Sommaire", X, y);
  y += 7;

  if (c.pieces.length === 0) {
    doc.setFont("helvetica", "italic").setFontSize(9.5).setTextColor(...GRIS);
    doc.text(
      c.genre === "pratique"
        ? "Aucun travail pratique n'a encore de support rédigé."
        : "Aucune séance théorique n'a encore de support rédigé.",
      X,
      y,
    );
    return;
  }

  doc.setFont("helvetica", "normal").setFontSize(9.5);
  for (const piece of c.pieces) {
    if (y > BAS - 6) break;
    doc.setTextColor(...GRIS);
    doc.text(String(piece.rang).padStart(2, "0"), X, y);
    doc.setTextColor(...ENCRE);
    const gauche = X + 9;
    const lignes = doc.splitTextToSize(
      [piece.objectif, piece.titre].filter(Boolean).join(" — "),
      LARGEUR - 9 - 26,
    );
    doc.text(lignes[0]!, gauche, y);
    if (piece.date) {
      doc.setTextColor(...GRIS);
      doc.text(piece.date, X + LARGEUR, y, { align: "right" });
    }
    y += 5.4;
  }
}

/** Le bandeau qui ouvre une séance dans la compilation. */
function chapitre(doc: jsPDF, piece: PieceCompilee, depart: number): number {
  let y = depart;

  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...GRIS);
  doc.text(
    [
      `Séance ${String(piece.rang).padStart(2, "0")}`,
      piece.date,
      piece.objectif,
    ]
      .filter(Boolean)
      .join("  ·  "),
    X,
    y,
  );
  y += 4;

  doc.setDrawColor(...TRAIT).setLineWidth(0.3);
  doc.line(X, y, X + LARGEUR, y);
  y += 8;

  return y;
}

export async function telechargerCompilationPdf(
  c: CompilationModule,
  nomFichier: string,
  marque?: Marque,
) {
  const doc = await construireCompilationPdf(c, marque);
  doc.save(nomFichier);
}
