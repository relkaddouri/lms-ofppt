import type jsPDF from "jspdf";
import {
  dessinerEntete,
  nomEtablissement,
  type Marque,
} from "@/lib/pdf-marque";
import { dessinerSupport, BAS, HAUT, LARGEUR, X } from "@/lib/pdf-support";
import { COULEURS, installerPolices, police } from "@/lib/pdf-theme";
import { formatDate, formatDateJour } from "@/lib/format";
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

  // La page de garde se dessine en dernier, sur la page 1 laissée blanche :
  // son sommaire donne la page de chaque séance, qu'on ne connaît qu'une fois
  // le cours posé.
  const debuts: number[] = [];

  // Chaque séance ouvre sa page : un document qu'on imprime pour le distribuer
  // se feuillette par séance, et un chapitre qui commence au milieu d'une page
  // se retrouve agrafé au précédent.
  for (const piece of c.pieces) {
    doc.addPage();
    debuts.push(doc.getNumberOfPages());
    const y = ouverture(doc, piece, HAUT);
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
      { entete: false },
    );
  }

  doc.setPage(1);
  couverture(doc, c, debuts, marque);
  habiller(doc, c, debuts);
  return doc;
}

export function titreCompilation(c: CompilationModule): string {
  return c.genre === "pratique"
    ? `Pratique de ${c.moduleNom}`
    : `Support du cours — ${c.moduleNom}`;
}

const numero = (rang: number) => String(rang).padStart(2, "0");

/** Le texte tronqué à une largeur, avec une ellipse s'il le faut. */
function tronquer(doc: jsPDF, texte: string, largeur: number): string {
  if (doc.getTextWidth(texte) <= largeur) return texte;
  let t = texte;
  while (t.length > 1 && doc.getTextWidth(`${t}…`) > largeur)
    t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/**
 * La page de garde.
 *
 * Elle porte l'identité de l'établissement comme les autres documents
 * officiels, et surtout le sommaire : c'est ce qui distingue une compilation
 * d'une pile de supports agrafés. Le sommaire donne la page de chaque séance
 * et y renvoie d'un clic : sans numéro, un sommaire de 109 pages ne guide pas.
 */
function couverture(
  doc: jsPDF,
  c: CompilationModule,
  debuts: number[],
  marque?: Marque,
) {
  let y = dessinerEntete(doc, marque, X, HAUT, LARGEUR);
  y += 16;

  // Un bandeau plein encre : c'est ce qui distingue au premier regard une
  // compilation d'un support de séance isolé.
  police(doc, "titre", 17);
  const lignesTitre = (
    doc.splitTextToSize(c.moduleNom, LARGEUR - 16) as string[]
  ).slice(0, 3);
  const hBandeau = 24 + lignesTitre.length * 7.5;
  doc.setFillColor(...COULEURS.encre);
  doc.rect(X, y, LARGEUR, hBandeau, "F");

  police(doc, "mono", 8);
  doc.setTextColor(...COULEURS.blanc);
  doc.text(
    c.genre === "pratique" ? "TRAVAUX PRATIQUES" : "SUPPORT DE COURS",
    X + 8,
    y + 11,
    { charSpace: 0.4 },
  );
  police(doc, "titre", 17);
  lignesTitre.forEach((l, i) => doc.text(l, X + 8, y + 21 + i * 7.5));

  y += hBandeau + 12;

  // L'identité, en deux colonnes : libellé en gris, valeur en encre.
  const identite: [string, string][] = [
    ["Groupe", c.groupeNom],
    ...(c.anneeScolaire
      ? ([["Année scolaire", c.anneeScolaire]] as [string, string][])
      : []),
    ...(c.formateur
      ? ([["Formateur", c.formateur]] as [string, string][])
      : []),
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
    const lignes = doc.splitTextToSize(valeur, LARGEUR - 34) as string[];
    doc.text(lignes, X + 34, y);
    y += 6 + (lignes.length - 1) * 4.5;
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

  c.pieces.forEach((piece, i) => {
    if (y > BAS - 4) return;
    const page = debuts[i]!;

    police(doc, "mono", 9);
    doc.setTextColor(...COULEURS.sarcelle);
    doc.text(numero(piece.rang), X, y);

    police(doc, "mono", 8.5);
    doc.setTextColor(...COULEURS.encre);
    doc.text(String(page), X + LARGEUR, y, { align: "right" });

    const date = piece.date ? formatDate(piece.date, "") : "";
    police(doc, "mono", 8);
    doc.setTextColor(...COULEURS.ardoiseClaire);
    if (date) doc.text(date, X + LARGEUR - 12, y, { align: "right" });

    police(doc, "corps", 9.5);
    doc.setTextColor(...COULEURS.corps);
    const intitule = [piece.objectif, piece.titre].filter(Boolean).join(" — ");
    const largeurTitre = LARGEUR - 12 - 42;
    doc.text(tronquer(doc, intitule, largeurTitre), X + 12, y);

    doc.link(X, y - 4, LARGEUR, 6.5, { pageNumber: page });

    y += 4.5;
    doc.setDrawColor(...COULEURS.separateur).setLineWidth(0.2);
    doc.line(X, y, X + LARGEUR, y);
    y += 4.5;
  });
}

/**
 * L'ouverture d'une séance, en haut de sa première page.
 *
 * Elle remplace trois en-têtes empilés — le bandeau de la compilation, le
 * titre du support et sa ligne d'identité — qui répétaient le module, le
 * groupe et la date avant la première ligne du cours.
 */
function ouverture(doc: jsPDF, piece: PieceCompilee, depart: number): number {
  let y = depart;

  doc.setFillColor(...COULEURS.sarcelle);
  doc.rect(X, y, 14, 1.2, "F");
  y += 7;

  police(doc, "mono", 8);
  doc.setTextColor(...COULEURS.sarcelle);
  doc.text(
    [
      `SÉANCE ${numero(piece.rang)}`,
      piece.objectif ? `ÉLÉMENT ${piece.objectif}` : null,
      piece.date ? formatDateJour(piece.date, {}, "").toUpperCase() : null,
    ]
      .filter(Boolean)
      .join("   ·   "),
    X,
    y,
    { charSpace: 0.3 },
  );
  y += 9;

  police(doc, "titre", 19);
  doc.setTextColor(...COULEURS.encre);
  const lignes = (doc.splitTextToSize(piece.titre, LARGEUR) as string[]).slice(
    0,
    3,
  );
  lignes.forEach((l, i) => doc.text(l, X, y + i * 8.4));
  y += (lignes.length - 1) * 8.4;

  // Le titre du support, quand il dit autre chose que l'objectif.
  const sousTitre = piece.support.titre?.trim();
  const meme = (a: string, b: string) =>
    a.toLowerCase().replace(/\W+/g, "") === b.toLowerCase().replace(/\W+/g, "");
  if (sousTitre && !meme(sousTitre, piece.titre)) {
    y += 7.5;
    police(doc, "corps", 11.5);
    doc.setTextColor(...COULEURS.ardoise);
    const sous = (doc.splitTextToSize(sousTitre, LARGEUR) as string[]).slice(
      0,
      2,
    );
    sous.forEach((l, i) => doc.text(l, X, y + i * 5.4));
    y += (sous.length - 1) * 5.4;
  }

  y += 6;
  doc.setDrawColor(...COULEURS.encre).setLineWidth(0.7);
  doc.line(X, y, X + LARGEUR, y);
  return y + 10;
}

/**
 * L'en-tête courant et le pied de page, posés une fois le document complet.
 *
 * En haut, le module et la séance en cours — on retrouve où l'on est en
 * ouvrant le classeur au hasard ; en bas, le groupe et la pagination. Ni la
 * page de garde ni la page qui ouvre une séance ne portent l'en-tête : elles
 * disent déjà, en grand, ce qu'il répéterait.
 */
function habiller(doc: jsPDF, c: CompilationModule, debuts: number[]) {
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);

    const rang = debuts.filter((d) => d <= p).length - 1;
    const piece = c.pieces[rang];
    if (p > 1 && piece && !debuts.includes(p)) {
      police(doc, "corps", 7.5);
      doc.setTextColor(...COULEURS.ardoise);
      doc.text(tronquer(doc, c.moduleNom, LARGEUR * 0.45), X, 12);
      const droite = `Séance ${numero(piece.rang)} · ${piece.titre}`;
      doc.text(tronquer(doc, droite, LARGEUR * 0.5), X + LARGEUR, 12, {
        align: "right",
      });
      doc.setDrawColor(...COULEURS.bordure).setLineWidth(0.25);
      doc.line(X, 14.2, X + LARGEUR, 14.2);
    }

    doc.setDrawColor(...COULEURS.bordure).setLineWidth(0.25);
    doc.line(X, 282.5, X + LARGEUR, 282.5);
    police(doc, "corps", 7.5);
    doc.setTextColor(...COULEURS.ardoise);
    const gauche = [
      c.genre === "pratique" ? "Travaux pratiques" : "Support de cours",
      c.groupeNom,
      c.anneeScolaire,
    ]
      .filter(Boolean)
      .join(" · ");
    doc.text(tronquer(doc, gauche, LARGEUR - 30), X, 287);
    police(doc, "mono", 7.5);
    doc.setTextColor(...COULEURS.encre);
    doc.text(`${p} / ${pages}`, X + LARGEUR, 287, { align: "right" });
  }
}

export async function telechargerCompilationPdf(
  c: CompilationModule,
  nomFichier: string,
  marque?: Marque,
) {
  const doc = await construireCompilationPdf(c, marque);
  doc.save(nomFichier);
}
