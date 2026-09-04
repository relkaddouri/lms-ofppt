import type jsPDF from "jspdf";
import { dessinerEntete, nomEtablissement, type Marque } from "@/lib/pdf-marque";
import { dessinerSupport, numeroterPages, BAS, HAUT, LARGEUR, X } from "@/lib/pdf-support";
import { COULEURS, installerPolices, police } from "@/lib/pdf-theme";
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
  await installerPolices(doc);

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
  y += 16;

  // Un bandeau plein encre : c'est ce qui distingue au premier regard une
  // compilation d'un support de séance isolé.
  const hBandeau = 34;
  doc.setFillColor(...COULEURS.encre);
  doc.rect(X, y, LARGEUR, hBandeau, "F");

  police(doc, "mono", 8);
  doc.setTextColor(...COULEURS.blanc);
  doc.text(
    c.genre === "pratique" ? "TRAVAUX PRATIQUES" : "SUPPORT DE COURS",
    X + 8,
    y + 10,
  );

  police(doc, "titre", 16);
  doc.setTextColor(...COULEURS.blanc);
  const lignesTitre = doc.splitTextToSize(titreCompilation(c), LARGEUR - 16);
  lignesTitre.slice(0, 2).forEach((l: string, i: number) => {
    doc.text(l, X + 8, y + 20 + i * 7);
  });

  y += hBandeau + 12;

  // L'identité, en deux colonnes : libellé en gris, valeur en encre.
  const identite: [string, string][] = [
    ["Groupe", c.groupeNom],
    ...(c.anneeScolaire ? ([["Année scolaire", c.anneeScolaire]] as [string, string][]) : []),
    ...(c.formateur ? ([["Formateur", c.formateur]] as [string, string][]) : []),
    ...(nomEtablissement(marque)
      ? ([["EFP", nomEtablissement(marque)!]] as [string, string][])
      : []),
    ["Édité le", c.edite],
  ];

  for (const [libelle, valeur] of identite) {
    police(doc, "corps", 9.5);
    doc.setTextColor(...COULEURS.ardoise);
    doc.text(libelle, X, y);
    police(doc, "corpsGras", 9.5);
    doc.setTextColor(...COULEURS.encre);
    doc.text(valeur, X + 34, y, { maxWidth: LARGEUR - 34 });
    y += 6;
  }

  y += 10;
  doc.setDrawColor(...COULEURS.bordure).setLineWidth(0.4);
  doc.line(X, y, X + LARGEUR, y);
  y += 10;

  police(doc, "titre", 12);
  doc.setTextColor(...COULEURS.encre);
  doc.text("Sommaire", X, y);
  y += 9;

  if (c.pieces.length === 0) {
    police(doc, "corps", 9.5);
    doc.setTextColor(...COULEURS.ardoise);
    doc.text(
      c.genre === "pratique"
        ? "Aucun travail pratique n'a encore de support rédigé."
        : "Aucune séance théorique n'a encore de support rédigé.",
      X,
      y,
    );
    return;
  }

  for (const piece of c.pieces) {
    if (y > BAS - 8) break;

    police(doc, "mono", 9);
    doc.setTextColor(...COULEURS.sarcelle);
    doc.text(String(piece.rang).padStart(2, "0"), X, y);

    police(doc, "corps", 9.5);
    doc.setTextColor(...COULEURS.corps);
    const largeurTitre = LARGEUR - 12 - 26;
    const intitule = [piece.objectif, piece.titre].filter(Boolean).join(" — ");
    doc.text(doc.splitTextToSize(intitule, largeurTitre)[0]!, X + 12, y);

    if (piece.date) {
      police(doc, "mono", 8.5);
      doc.setTextColor(...COULEURS.ardoiseClaire);
      doc.text(piece.date, X + LARGEUR, y, { align: "right" });
    }

    y += 4.5;
    doc.setDrawColor(...COULEURS.separateur).setLineWidth(0.2);
    doc.line(X, y, X + LARGEUR, y);
    y += 4.5;
  }
}

/** Le bandeau qui ouvre une séance dans la compilation. */
function chapitre(doc: jsPDF, piece: PieceCompilee, depart: number): number {
  let y = depart;

  // Le numéro de séance en sarcelle, gros et à gauche : c'est le repère qu'on
  // cherche en feuilletant un document de plusieurs dizaines de pages.
  police(doc, "mono", 15);
  doc.setTextColor(...COULEURS.sarcelle);
  doc.text(String(piece.rang).padStart(2, "0"), X, y + 4);

  police(doc, "corps", 8.5);
  doc.setTextColor(...COULEURS.ardoise);
  doc.text(
    [piece.date, piece.objectif].filter(Boolean).join("  ·  "),
    X + 14,
    y,
  );

  police(doc, "titre", 11);
  doc.setTextColor(...COULEURS.encre);
  const lignes = doc.splitTextToSize(piece.titre, LARGEUR - 14);
  lignes.slice(0, 2).forEach((l: string, i: number) => {
    doc.text(l, X + 14, y + 5.5 + i * 5.5);
  });

  y += 5.5 + Math.min(lignes.length, 2) * 5.5;

  doc.setDrawColor(...COULEURS.encre).setLineWidth(0.6);
  doc.line(X, y, X + LARGEUR, y);
  y += 9;

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
