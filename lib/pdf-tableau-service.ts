import type jsPDF from "jspdf";
import { dessinerLogo, nomEtablissement, type Marque } from "@/lib/pdf-marque";

/**
 * Tableau de service — le document de masse horaire de la Direction Régionale.
 *
 * Il ne ressemble à aucun autre export de l'application : c'est un tableau
 * administratif signé par le formateur et le Directeur Pédagogique, dont la
 * structure est reprise d'un exemplaire réel (PRD §4.13bis). Chaque ligne y
 * porte quatre valeurs — présentiel et distance, croisés avec le semestre —
 * et non un total unique.
 *
 * La part à distance d'un module partagé entre deux groupes n'est portée que
 * par une seule des deux lignes : sur l'exemplaire officiel, les cellules de
 * l'autre sont laissées vides. C'est ce qui sépare la charge réelle du
 * formateur de la progression cumulée de ses groupes.
 */

export type LignePdfService = {
  filiere: string;
  groupe: string;
  annee: string;
  codeModule: string;
  module: string;
  pS1: number;
  sS1: number;
  pS2: number;
  sS2: number;
  /** Cellules FAD laissées vides, comme sur le document officiel. */
  fadMutualisee: boolean;
};

export type EnteteService = {
  marque: Marque;
  codeSecteur: string | null;
  formateur: string;
  specialite: string | null;
  niveauFormation: string | null;
  anneeScolaire: string | null;
  matricule: string | null;
};

const ENCRE: [number, number, number] = [17, 24, 39];
const GRIS: [number, number, number] = [107, 114, 128];
const TRAIT: [number, number, number] = [140, 140, 140];
const FOND: [number, number, number] = [238, 240, 243];

const X = 12;
const BAS = 172;

type Colonne = { titre: string; largeur: number; nombre?: boolean };

const COLONNES: Colonne[] = [
  { titre: "Filière", largeur: 48 },
  { titre: "Groupe", largeur: 26 },
  { titre: "Année de Formation", largeur: 26 },
  { titre: "Code Module", largeur: 24 },
  { titre: "Module", largeur: 77 },
  { titre: "MHT AFF P S1", largeur: 18, nombre: true },
  { titre: "MHT AFF S S1", largeur: 18, nombre: true },
  { titre: "MHT AFF P S2", largeur: 18, nombre: true },
  { titre: "MHT AFF S S2", largeur: 18, nombre: true },
];

const LARGEUR = COLONNES.reduce((t, c) => t + c.largeur, 0);

const XS = COLONNES.reduce<number[]>((acc, c) => {
  acc.push((acc[acc.length - 1] ?? X) + (acc.length ? COLONNES[acc.length - 1].largeur : 0));
  return acc;
}, []);

const HAUTEUR_ENTETE = 11;

function enTeteColonnes(doc: jsPDF, y: number): number {
  doc.setFillColor(...FOND);
  doc.rect(X, y, LARGEUR, HAUTEUR_ENTETE, "F");
  doc.setFont("helvetica", "bold").setFontSize(6.6).setTextColor(...ENCRE);

  COLONNES.forEach((c, i) => {
    // « MHT AFF P S1 » et « Année de Formation » ne tiennent pas sur une ligne
    // dans des colonnes de 18 à 26 mm : l'en-tête s'enroule au lieu de tronquer.
    const lignes = doc.splitTextToSize(c.titre, c.largeur - 3) as string[];
    const haut = y + (HAUTEUR_ENTETE - lignes.length * 2.9) / 2 + 2.4;
    if (c.nombre) {
      doc.text(lignes, XS[i] + c.largeur - 2, haut, { align: "right" });
    } else {
      doc.text(lignes, XS[i] + 2, haut);
    }
  });

  doc.setDrawColor(...TRAIT).setLineWidth(0.3);
  doc.rect(X, y, LARGEUR, HAUTEUR_ENTETE);
  XS.slice(1).forEach((x) => doc.line(x, y, x, y + HAUTEUR_ENTETE));
  return y + HAUTEUR_ENTETE;
}

/** Le bloc d'identité en haut à gauche du document officiel. */
function identite(doc: jsPDF, e: EnteteService, y: number): number {
  const champs: [string, string][] = [
    ["Code Secteur", e.codeSecteur ?? ""],
    ["Formateur", e.formateur],
    ["Spécialité", e.specialite ?? ""],
    ["Niveau de formation", e.niveauFormation ?? ""],
    ["Année Scolaire", e.anneeScolaire ?? ""],
  ];

  const lLibelle = 34;
  const lValeur = 52;
  const hLigne = 5;

  champs.forEach(([libelle, valeur], i) => {
    const haut = y + i * hLigne;
    doc.setFillColor(...FOND);
    doc.rect(X, haut, lLibelle, hLigne, "F");
    doc.setDrawColor(...TRAIT).setLineWidth(0.2);
    doc.rect(X, haut, lLibelle, hLigne);
    doc.rect(X + lLibelle, haut, lValeur, hLigne);

    doc.setFont("helvetica", "bold").setFontSize(6.4).setTextColor(...ENCRE);
    doc.text(libelle, X + 1.5, haut + 3.4);
    doc.setFont("helvetica", "normal").setTextColor(...ENCRE);
    doc.text(
      (doc.splitTextToSize(valeur, lValeur - 3) as string[])[0] ?? "",
      X + lLibelle + 1.5,
      haut + 3.4,
    );
  });

  const bas = y + champs.length * hLigne;

  // Titre au centre, logo à droite : la disposition du document officiel.
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...ENCRE);
  doc.text(
    `Tableau de service pour l'année ${e.anneeScolaire ?? ""}`.trim(),
    X + LARGEUR / 2,
    y + 12,
    { align: "center" },
  );

  const largeurLogo = dessinerLogo(doc, e.marque, X + LARGEUR - 52, y + 2, 15, 52);
  if (largeurLogo === 0) {
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...GRIS);
    doc.text(
      doc.splitTextToSize(nomEtablissement(e.marque), 52) as string[],
      X + LARGEUR,
      y + 6,
      { align: "right" },
    );
  }

  return bas + 6;
}

/** Le cadre de signature du bas de page. */
function signatures(doc: jsPDF, e: EnteteService, y: number): void {
  const cols = [
    { titre: "Formateur", largeur: 46, valeur: e.formateur },
    { titre: "Matricule", largeur: 34, valeur: e.matricule ?? "" },
    { titre: "Signature", largeur: 40, valeur: "" },
    { titre: "Directeur Pédagogique - Directeur d'EFP", largeur: LARGEUR - 120, valeur: "" },
  ];

  const hTitre = 6;
  const hCorps = 22;
  let x = X;

  for (const c of cols) {
    doc.setFillColor(...FOND);
    doc.rect(x, y, c.largeur, hTitre, "F");
    doc.setDrawColor(...TRAIT).setLineWidth(0.3);
    doc.rect(x, y, c.largeur, hTitre);
    doc.rect(x, y + hTitre, c.largeur, hCorps);

    doc.setFont("helvetica", "bold").setFontSize(6.8).setTextColor(...ENCRE);
    doc.text(
      (doc.splitTextToSize(c.titre, c.largeur - 3) as string[])[0] ?? "",
      x + c.largeur / 2,
      y + 4,
      { align: "center" },
    );

    if (c.valeur) {
      doc.setFont("helvetica", "normal").setFontSize(7.5);
      doc.text(c.valeur, x + c.largeur / 2, y + hTitre + 7, { align: "center" });
    }
    x += c.largeur;
  }

  // La mention manuscrite du document, laissée à compléter.
  doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...ENCRE);
  doc.text(
    "Fait à ………………………………  le ……/……/…………",
    X + LARGEUR - (LARGEUR - 120) / 2 - 0,
    y + hTitre + 13,
    { align: "center" },
  );
}

export async function construireTableauServicePdf(
  e: EnteteService,
  lignes: LignePdfService[],
): Promise<jsPDF> {
  const { default: JsPDF } = await import("jspdf");
  const doc = new JsPDF({ unit: "mm", format: "a4", orientation: "landscape" });

  let y = identite(doc, e, 12);
  y = enTeteColonnes(doc, y);

  const total = { pS1: 0, sS1: 0, pS2: 0, sS2: 0 };
  let anneePrecedente: string | null = null;

  const cellule = (n: number) => (n === 0 ? "0" : String(n));

  for (const l of lignes) {
    // Le document sépare les années par une ligne vide : sans elle, le passage
    // du tronc commun à la spécialisation ne se voit pas.
    if (anneePrecedente !== null && l.annee !== anneePrecedente) {
      if (y + 4 <= BAS) {
        doc.setDrawColor(...TRAIT).setLineWidth(0.2);
        doc.rect(X, y, LARGEUR, 4);
        XS.slice(1).forEach((x) => doc.line(x, y, x, y + 4));
        y += 4;
      }
    }
    anneePrecedente = l.annee;

    doc.setFont("helvetica", "normal").setFontSize(7);
    const filiere = doc.splitTextToSize(l.filiere, COLONNES[0].largeur - 3) as string[];
    const module = doc.splitTextToSize(l.module, COLONNES[4].largeur - 3) as string[];
    const hauteur = Math.max(6.5, Math.max(filiere.length, module.length) * 3.2 + 3);

    if (y + hauteur > BAS) {
      doc.addPage();
      y = enTeteColonnes(doc, 14);
    }

    const cellules: (string | string[])[] = [
      filiere,
      l.groupe,
      l.annee,
      l.codeModule,
      module,
      cellule(l.pS1),
      // Vide, pas zéro : le document distingue « aucune heure » de « portée par
      // l'autre groupe ».
      l.fadMutualisee ? "" : cellule(l.sS1),
      cellule(l.pS2),
      l.fadMutualisee ? "" : cellule(l.sS2),
    ];

    doc.setTextColor(...ENCRE);
    COLONNES.forEach((c, i) => {
      const texte = cellules[i];
      if (!texte.length) return;
      if (c.nombre) {
        doc.text(texte as string, XS[i] + c.largeur - 2, y + 4.2, { align: "right" });
      } else {
        doc.text(texte, XS[i] + 2, y + 4.2);
      }
    });

    doc.setDrawColor(...TRAIT).setLineWidth(0.2);
    doc.rect(X, y, LARGEUR, hauteur);
    XS.slice(1).forEach((x) => doc.line(x, y, x, y + hauteur));

    if (!l.fadMutualisee) {
      total.sS1 += l.sS1;
      total.sS2 += l.sS2;
    }
    total.pS1 += l.pS1;
    total.pS2 += l.pS2;
    y += hauteur;
  }

  const general = total.pS1 + total.sS1 + total.pS2 + total.sS2;

  if (y + 16 > BAS) {
    doc.addPage();
    y = enTeteColonnes(doc, 14);
  }

  // ── Ligne de total, une valeur par colonne ────────────────────────────
  doc.setFillColor(...FOND);
  doc.rect(X, y, LARGEUR, 7, "F");
  doc.setDrawColor(...TRAIT).setLineWidth(0.3);
  doc.rect(X, y, LARGEUR, 7);
  doc.line(XS[5], y, XS[5], y + 7);
  doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...ENCRE);
  doc.text("Total", XS[5] - 2, y + 4.7, { align: "right" });
  [total.pS1, total.sS1, total.pS2, total.sS2].forEach((v, i) => {
    const c = 5 + i;
    doc.line(XS[c], y, XS[c], y + 7);
    doc.text(String(v), XS[c] + COLONNES[c].largeur - 2, y + 4.7, { align: "right" });
  });
  y += 7;

  // ── Total général ─────────────────────────────────────────────────────
  doc.setFillColor(...FOND);
  doc.rect(XS[5], y, LARGEUR + X - XS[5], 7, "F");
  doc.setDrawColor(...TRAIT).setLineWidth(0.3);
  doc.rect(XS[5], y, LARGEUR + X - XS[5], 7);
  doc.line(XS[8], y, XS[8], y + 7);
  doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...ENCRE);
  doc.text("MHT AFF S1+S2 (P+S)", XS[8] - 2, y + 4.7, { align: "right" });
  doc.text(String(general), X + LARGEUR - 2, y + 4.7, { align: "right" });
  y += 7;

  signatures(doc, e, y + 6);

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(...GRIS);
    doc.text(`${p} / ${pages}`, X + LARGEUR, 202, { align: "right" });
  }

  return doc;
}

export async function telechargerTableauServicePdf(
  e: EnteteService,
  lignes: LignePdfService[],
  nomFichier: string,
): Promise<void> {
  const doc = await construireTableauServicePdf(e, lignes);
  doc.save(nomFichier);
}
