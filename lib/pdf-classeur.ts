import type jsPDF from "jspdf";
import {
  dessinerFiche,
  ENCRE,
  HAUT,
  LARGEUR,
  TRAIT,
  X,
  type FichePdf,
} from "@/lib/pdf-fiche";

/**
 * Classeur pédagogique : les fiches d'une période reliées en un seul document.
 *
 * C'est la forme sous laquelle le cahier du formateur se présente en
 * inspection — page de garde, fiches dans l'ordre des séances, pagination
 * continue. La mise en page d'une fiche n'est pas réécrite ici : elle vient de
 * `pdf-fiche`, qui reste la seule à connaître le formulaire officiel.
 */

export type EnteteClasseur = {
  etablissement: string;
  filiere: string;
  groupe: string;
  module: string;
  /** Bornes réellement demandées, affichées telles quelles. */
  debut: string;
  fin: string;
};

export type FicheDatee = { date: string | null; fiche: FichePdf };

const GRIS: [number, number, number] = [107, 114, 128];

function pageDeGarde(
  doc: jsPDF,
  entete: EnteteClasseur,
  fiches: FicheDatee[],
): void {
  let y = 60;

  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...GRIS);
  doc.text(entete.etablissement.toUpperCase(), X, y);
  y += 14;

  doc.setFont("helvetica", "bold").setFontSize(24).setTextColor(...ENCRE);
  doc.text("Classeur pédagogique", X, y);
  y += 10;

  doc.setFont("helvetica", "normal").setFontSize(12).setTextColor(...GRIS);
  doc.text(`Du ${entete.debut} au ${entete.fin}`, X, y);
  y += 16;

  doc.setDrawColor(...TRAIT).setLineWidth(0.4);
  doc.line(X, y, X + LARGEUR, y);
  y += 12;

  const champs: [string, string][] = [
    ["Filière", entete.filiere],
    ["Groupe", entete.groupe],
    ["Module", entete.module],
    [
      "Fiches réunies",
      `${fiches.length} séance${fiches.length > 1 ? "s" : ""}`,
    ],
  ];

  for (const [libelle, valeur] of champs) {
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(...GRIS);
    doc.text(libelle, X, y);
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...ENCRE);
    doc.text(valeur, X + 40, y);
    y += 9;
  }

  y += 10;

  // Sommaire : sans lui, retrouver la séance du 14 dans trente pages se fait
  // au pouce mouillé.
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...ENCRE);
  doc.text("Sommaire", X, y);
  y += 7;

  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...ENCRE);
  fiches.forEach((f, i) => {
    if (y > 270) {
      doc.addPage();
      y = HAUT;
    }
    const date = f.date ?? "date non fixée";
    const objectif = f.fiche.objectifs || f.fiche.module;
    const ligne = doc.splitTextToSize(
      `${i + 1}.  ${date} — ${objectif}`,
      LARGEUR,
    );
    doc.text(ligne[0], X, y);
    y += 5.5;
  });
}

/** Numérotation continue, posée à la fin quand le total est connu. */
function paginer(doc: jsPDF, entete: EnteteClasseur): void {
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...GRIS);
    if (p > 1) {
      doc.text(`${entete.groupe} · ${entete.module}`, X, 290);
    }
    doc.text(`${p} / ${total}`, X + LARGEUR, 290, { align: "right" });
  }
}

export async function construireClasseurPdf(
  entete: EnteteClasseur,
  fiches: FicheDatee[],
): Promise<jsPDF> {
  const { default: JsPDF } = await import("jspdf");
  const doc = new JsPDF({ unit: "mm", format: "a4" });

  pageDeGarde(doc, entete, fiches);

  for (const f of fiches) {
    doc.addPage();
    dessinerFiche(doc, f.fiche);
  }

  paginer(doc, entete);
  return doc;
}

export async function telechargerClasseurPdf(
  entete: EnteteClasseur,
  fiches: FicheDatee[],
  nomFichier: string,
) {
  const doc = await construireClasseurPdf(entete, fiches);
  doc.save(nomFichier);
}
