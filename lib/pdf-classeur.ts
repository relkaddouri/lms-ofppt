import type jsPDF from "jspdf";
import { dessinerEntete, type Marque } from "@/lib/pdf-marque";
import { COULEURS, installerPolices, police } from "@/lib/pdf-theme";
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
  filiere: string;
  groupe: string;
  module: string;
  /** Bornes réellement demandées, affichées telles quelles. */
  debut: string;
  fin: string;
};

export type FicheDatee = { date: string | null; fiche: FichePdf };

const GRIS = COULEURS.ardoise;

function pageDeGarde(
  doc: jsPDF,
  entete: EnteteClasseur,
  fiches: FicheDatee[],
  marque?: Marque,
): void {
  // Le bandeau d'identité tient lieu de ce qui n'était qu'un sigle en
  // majuscules : sur une page de garde, le logo du centre a sa place.
  let y = dessinerEntete(doc, marque, X, 52, LARGEUR, 16) + 6;

  police(doc, "titre", 24);
  doc.setTextColor(...ENCRE);
  doc.text("Classeur pédagogique", X, y);
  y += 10;

  police(doc, "corps", 12);
  doc.setTextColor(...GRIS);
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
    police(doc, "corps", 10);
    doc.setTextColor(...GRIS);
    doc.text(libelle, X, y);
    police(doc, "titre", 11);
    doc.setTextColor(...ENCRE);
    doc.text(valeur, X + 40, y);
    y += 9;
  }

  y += 10;

  // Sommaire : sans lui, retrouver la séance du 14 dans trente pages se fait
  // au pouce mouillé.
  police(doc, "titre", 11);
  doc.setTextColor(...ENCRE);
  doc.text("Sommaire", X, y);
  y += 7;

  police(doc, "corps", 9);
  doc.setTextColor(...ENCRE);
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
    police(doc, "corps", 8);
    doc.setTextColor(...GRIS);
    if (p > 1) {
      doc.text(`${entete.groupe} · ${entete.module}`, X, 290);
    }
    doc.text(`${p} / ${total}`, X + LARGEUR, 290, { align: "right" });
  }
}

export async function construireClasseurPdf(
  entete: EnteteClasseur,
  fiches: FicheDatee[],
  marque?: Marque,
): Promise<jsPDF> {
  const { default: JsPDF } = await import("jspdf");
  const doc = new JsPDF({ unit: "mm", format: "a4" });
  await installerPolices(doc);

  pageDeGarde(doc, entete, fiches, marque);

  for (const f of fiches) {
    doc.addPage();
    dessinerFiche(doc, f.fiche, marque);
  }

  paginer(doc, entete);
  return doc;
}

export async function telechargerClasseurPdf(
  entete: EnteteClasseur,
  fiches: FicheDatee[],
  nomFichier: string,
  marque?: Marque,
) {
  const doc = await construireClasseurPdf(entete, fiches, marque);
  doc.save(nomFichier);
}
