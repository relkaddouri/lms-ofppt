import type jsPDF from "jspdf";

/**
 * Tableau de service — le document de masse horaire de la Direction Régionale.
 *
 * Il ne ressemble à aucun autre export de l'application : c'est un tableau
 * administratif signé par le formateur, le Directeur Pédagogique et le
 * Directeur Régional (PRD §4.13bis). L'ordre des colonnes et le bloc de
 * signatures reprennent le document papier ; deux colonnes s'y ajoutent,
 * Présentiel et FAD, qui n'y figurent pas mais servent au suivi du formateur.
 *
 * MUT et EFP restent vides : l'application ne détient aucune donnée qui leur
 * corresponde. Elles sont conservées pour que le tableau se superpose au
 * document officiel et se complète à la main, plutôt que d'être supprimées.
 */

export type LignePdfService = {
  dateAffectation: string;
  filiere: string;
  annee: string;
  groupe: string;
  codeModule: string;
  module: string;
  mhAffectee: number;
  heuresPresentiel: number;
  heuresFad: number;
};

export type EnteteService = {
  etablissement: string;
  formateur: string;
  /** Date d'édition, affichée telle quelle. */
  edite: string;
};

const ENCRE: [number, number, number] = [17, 24, 39];
const GRIS: [number, number, number] = [107, 114, 128];
const TRAIT: [number, number, number] = [140, 140, 140];
const FOND: [number, number, number] = [238, 240, 243];

const X = 12;
const BAS = 178;

type Colonne = {
  titre: string;
  largeur: number;
  aligne?: "right";
  /** Colonne hors document officiel, grisée dans l'en-tête. */
  ajout?: boolean;
};

const COLONNES: Colonne[] = [
  { titre: "Date d'affectation", largeur: 24 },
  { titre: "Filière", largeur: 30 },
  { titre: "Année", largeur: 14 },
  { titre: "Groupe", largeur: 22 },
  { titre: "Code", largeur: 16 },
  { titre: "Module", largeur: 77 },
  { titre: "MH AFF", largeur: 18, aligne: "right" },
  { titre: "Présentiel", largeur: 22, aligne: "right", ajout: true },
  { titre: "FAD", largeur: 16, aligne: "right", ajout: true },
  { titre: "MUT", largeur: 16 },
  { titre: "EFP", largeur: 18 },
];

const LARGEUR = COLONNES.reduce((t, c) => t + c.largeur, 0);

function bords(): number[] {
  const xs: number[] = [];
  let x = X;
  for (const c of COLONNES) {
    xs.push(x);
    x += c.largeur;
  }
  return xs;
}

const XS = bords();

const HAUTEUR_ENTETE = 9.5;

function enTeteColonnes(doc: jsPDF, y: number): number {
  doc.setFillColor(...FOND);
  doc.rect(X, y, LARGEUR, HAUTEUR_ENTETE, "F");
  doc.setFont("helvetica", "bold").setFontSize(7.5);

  COLONNES.forEach((c, i) => {
    // Grisées, les deux colonnes qui n'appartiennent pas au document officiel :
    // à la lecture on distingue tout de suite l'ajout de l'original.
    doc.setTextColor(...(c.ajout ? GRIS : ENCRE));
    // « Date d'affectation » ne tient pas sur une ligne de 24 mm : l'en-tête
    // s'enroule au lieu de tronquer, sinon la colonne s'annonce « Date ».
    const lignes = doc.splitTextToSize(c.titre, c.largeur - 4) as string[];
    const haut = y + (lignes.length > 1 ? 4 : 5.9);
    if (c.aligne === "right") {
      doc.text(lignes, XS[i] + c.largeur - 2, haut, { align: "right" });
    } else {
      doc.text(lignes, XS[i] + 2, haut);
    }
  });

  doc.setDrawColor(...TRAIT).setLineWidth(0.3);
  doc.rect(X, y, LARGEUR, HAUTEUR_ENTETE);
  return y + HAUTEUR_ENTETE;
}

function entete(doc: jsPDF, e: EnteteService, y: number): number {
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...GRIS);
  doc.text(e.etablissement.toUpperCase(), X, y);
  y += 7;

  doc.setFont("helvetica", "bold").setFontSize(17).setTextColor(...ENCRE);
  doc.text("Tableau de service", X, y);
  y += 6;

  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...GRIS);
  doc.text(`${e.formateur} — édité le ${e.edite}`, X, y);
  return y + 6;
}

/** Les trois signatures du document officiel, posées côte à côte. */
function signatures(doc: jsPDF, y: number): void {
  const titres = ["Le formateur", "Le Directeur Pédagogique", "Le Directeur Régional"];
  const largeur = LARGEUR / 3;

  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...GRIS);
  titres.forEach((t, i) => {
    const x = X + i * largeur;
    doc.text(t, x + largeur / 2, y, { align: "center" });
    doc.setDrawColor(...TRAIT).setLineWidth(0.3);
    doc.rect(x + 6, y + 3, largeur - 12, 22);
  });
}

export async function construireTableauServicePdf(
  e: EnteteService,
  lignes: LignePdfService[],
): Promise<jsPDF> {
  const { default: JsPDF } = await import("jspdf");
  const doc = new JsPDF({ unit: "mm", format: "a4", orientation: "landscape" });

  let y = entete(doc, e, 18);
  y = enTeteColonnes(doc, y);

  const total = { mh: 0, presentiel: 0, fad: 0 };

  for (const l of lignes) {
    doc.setFont("helvetica", "normal").setFontSize(7.5);
    // Filière et Module sont les deux seules colonnes dont le texte déborde :
    // « Digital Design - Option UX Designer » et les intitulés du référentiel.
    // Elles s'enroulent sur plusieurs lignes, la hauteur de ligne suit la plus
    // haute des deux — les tronquer ferait perdre l'information au document.
    const filiere = doc.splitTextToSize(l.filiere, COLONNES[1].largeur - 4) as string[];
    const module = doc.splitTextToSize(l.module, COLONNES[5].largeur - 4) as string[];
    const hauteur = Math.max(7, Math.max(filiere.length, module.length) * 3.6 + 3.4);

    // Le tableau se poursuit page après page, en-tête de colonnes répété :
    // sans cela une deuxième page arriverait sans repère de lecture.
    if (y + hauteur > BAS) {
      doc.addPage();
      y = enTeteColonnes(doc, 18);
    }

    const cellules: (string | string[])[] = [
      l.dateAffectation,
      filiere,
      l.annee,
      l.groupe,
      l.codeModule,
      module,
      String(l.mhAffectee),
      String(l.heuresPresentiel),
      String(l.heuresFad),
      "",
      "",
    ];

    doc.setTextColor(...ENCRE);
    COLONNES.forEach((c, i) => {
      const texte = cellules[i];
      if (!texte.length) return;
      if (c.aligne === "right") {
        doc.text(texte as string, XS[i] + c.largeur - 2, y + 4.6, { align: "right" });
      } else {
        doc.text(texte, XS[i] + 2, y + 4.6);
      }
    });

    doc.setDrawColor(...TRAIT).setLineWidth(0.2);
    doc.rect(X, y, LARGEUR, hauteur);
    XS.slice(1).forEach((x) => doc.line(x, y, x, y + hauteur));

    total.mh += l.mhAffectee;
    total.presentiel += l.heuresPresentiel;
    total.fad += l.heuresFad;
    y += hauteur;
  }

  if (y + 9 > BAS) {
    doc.addPage();
    y = 18;
  }

  doc.setFillColor(...FOND);
  doc.rect(X, y, LARGEUR, 9, "F");
  doc.setDrawColor(...TRAIT).setLineWidth(0.3);
  doc.rect(X, y, LARGEUR, 9);
  doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(...ENCRE);
  doc.text("Total général", XS[0] + 2, y + 5.8);
  doc.text(String(total.mh), XS[6] + COLONNES[6].largeur - 2, y + 5.8, { align: "right" });
  doc.text(String(total.presentiel), XS[7] + COLONNES[7].largeur - 2, y + 5.8, { align: "right" });
  doc.text(String(total.fad), XS[8] + COLONNES[8].largeur - 2, y + 5.8, { align: "right" });
  y += 9;

  doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(...GRIS);
  doc.text(
    "Présentiel et FAD ne figurent pas sur le document officiel : ils décomposent la masse horaire affectée pour le suivi du formateur. MUT et EFP sont à compléter.",
    X,
    y + 5,
  );

  signatures(doc, y + 16);

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
