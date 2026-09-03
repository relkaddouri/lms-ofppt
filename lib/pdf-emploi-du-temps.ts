import type jsPDF from "jspdf";
import { dessinerEntete, type Marque } from "@/lib/pdf-marque";
import { JOURS } from "@/lib/motifs";

/**
 * Emploi du temps — section I.B du cahier du formateur.
 *
 * Le document ne montre pas les séances mais le **rythme** qui les place :
 * les jours en colonnes, les créneaux en lignes, le groupe dans la case. La
 * grille de l'écran est reprise telle quelle, c'est la forme que le cahier
 * papier attend.
 *
 * Les motifs précédents suivent le motif courant, chacun avec sa période de
 * validité : un rythme change en cours d'année, et le cahier doit montrer
 * lequel s'appliquait quand.
 */

export type CreneauPdf = {
  jour_semaine: number;
  heure_debut: string;
  heure_fin: string;
  groupeNom: string;
};

export type MotifPdf = {
  libelle: string | null;
  date_debut: string;
  date_fin: string | null;
  courant: boolean;
  creneaux: CreneauPdf[];
};

export type EnteteEmploi = {
  marque: Marque;
  formateur: string;
  anneeScolaire: string | null;
  edite: string;
};

const ENCRE: [number, number, number] = [17, 24, 39];
const GRIS: [number, number, number] = [107, 114, 128];
const TRAIT: [number, number, number] = [140, 140, 140];
const FOND: [number, number, number] = [238, 240, 243];
const TEINTE: [number, number, number] = [232, 242, 247];

const X = 14;
const LARGEUR = 269;
const BAS = 190;
const L_CRENEAU = 35;

/** Une case par jour ouvré, le créneau occupant la première colonne. */
const L_JOUR = (LARGEUR - L_CRENEAU) / JOURS.length;

/** « 08:30:00 » ne se lit pas sur un document affiché au mur. */
function heure(h: string): string {
  return h.slice(0, 5).replace(":", " h ");
}

function periode(m: MotifPdf): string {
  const depuis = `du ${m.date_debut.split("-").reverse().join("/")}`;
  return m.date_fin
    ? `${depuis} au ${m.date_fin.split("-").reverse().join("/")}`
    : `${depuis} — en vigueur`;
}

/**
 * Dessine un motif et renvoie l'ordonnée sous la grille.
 *
 * Les lignes sont les créneaux réellement déclarés, dans l'ordre horaire :
 * une grille d'heures fixes laisserait des rangées vides sur un document
 * qu'on affiche.
 */
function dessinerMotif(doc: jsPDF, m: MotifPdf, y: number): number {
  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...ENCRE);
  doc.text(m.libelle?.trim() || "Rythme hebdomadaire", X, y);
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...GRIS);
  doc.text(periode(m), X + LARGEUR, y, { align: "right" });
  y += 4;

  const lignes = [
    ...new Set(m.creneaux.map((c) => `${c.heure_debut}|${c.heure_fin}`)),
  ].sort();

  if (lignes.length === 0) {
    doc.setFont("helvetica", "italic").setFontSize(9).setTextColor(...GRIS);
    doc.text("Aucun créneau déclaré.", X, y + 5);
    return y + 10;
  }

  // ── En-tête des jours ───────────────────────────────────────────────
  const hEntete = 8;
  doc.setFillColor(...FOND);
  doc.rect(X, y, LARGEUR, hEntete, "F");
  doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...ENCRE);
  doc.text("Créneau", X + 2, y + 5.4);
  JOURS.forEach((j, i) => {
    doc.text(j.long, X + L_CRENEAU + i * L_JOUR + L_JOUR / 2, y + 5.4, {
      align: "center",
    });
  });
  doc.setDrawColor(...TRAIT).setLineWidth(0.3);
  doc.rect(X, y, LARGEUR, hEntete);
  y += hEntete;

  // ── Une ligne par créneau horaire ───────────────────────────────────
  const hLigne = 11;
  for (const ligne of lignes) {
    const [debut, fin] = ligne.split("|");

    doc.setDrawColor(...TRAIT).setLineWidth(0.2);
    doc.rect(X, y, LARGEUR, hLigne);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...ENCRE);
    doc.text(heure(debut), X + 2, y + 4.6);
    doc.text(heure(fin), X + 2, y + 8.4);
    doc.line(X + L_CRENEAU, y, X + L_CRENEAU, y + hLigne);

    JOURS.forEach((j, i) => {
      const xCase = X + L_CRENEAU + i * L_JOUR;
      doc.line(xCase, y, xCase, y + hLigne);

      const occupants = m.creneaux.filter(
        (c) =>
          c.jour_semaine === j.valeur &&
          c.heure_debut === debut &&
          c.heure_fin === fin,
      );
      if (occupants.length === 0) return;

      // Une case occupée se teinte : sur un document affiché, la couleur se
      // lit avant le texte.
      doc.setFillColor(...TEINTE);
      doc.rect(xCase + 0.5, y + 0.5, L_JOUR - 1, hLigne - 1, "F");
      doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...ENCRE);
      const noms = doc.splitTextToSize(
        occupants.map((o) => o.groupeNom).join(" · "),
        L_JOUR - 3,
      ) as string[];
      const haut = y + (hLigne - noms.length * 3.4) / 2 + 2.6;
      doc.text(noms.slice(0, 3), xCase + L_JOUR / 2, haut, { align: "center" });
    });

    y += hLigne;
  }

  return y;
}

export async function construireEmploiDuTempsPdf(
  e: EnteteEmploi,
  motifs: MotifPdf[],
): Promise<jsPDF> {
  const { default: JsPDF } = await import("jspdf");
  const doc = new JsPDF({ unit: "mm", format: "a4", orientation: "landscape" });

  let y = dessinerEntete(doc, e.marque, X, 14, LARGEUR, 14);

  doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(...ENCRE);
  doc.text("Emploi du temps", X, y);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...GRIS);
  doc.text(
    [e.formateur, e.anneeScolaire, `édité le ${e.edite}`]
      .filter(Boolean)
      .join(" — "),
    X + LARGEUR,
    y,
    { align: "right" },
  );
  y += 4;
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...GRIS);
  doc.text("Section I.B du cahier du formateur", X, y);
  y += 8;

  const courant = motifs.filter((m) => m.courant);
  const precedents = motifs.filter((m) => !m.courant);

  for (const m of [...courant, ...precedents]) {
    // Une grille ne se coupe pas entre deux pages : elle se lit d'un bloc.
    const hauteur =
      12 + new Set(m.creneaux.map((c) => `${c.heure_debut}|${c.heure_fin}`)).size * 11;
    if (y + hauteur > BAS) {
      doc.addPage();
      y = 16;
    }
    y = dessinerMotif(doc, m, y) + 9;
  }

  if (motifs.length === 0) {
    doc.setFont("helvetica", "italic").setFontSize(10).setTextColor(...GRIS);
    doc.text("Aucun rythme hebdomadaire déclaré.", X, y + 6);
  }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(...GRIS);
    doc.text(`${p} / ${pages}`, X + LARGEUR, 200, { align: "right" });
  }

  return doc;
}

export async function telechargerEmploiDuTempsPdf(
  e: EnteteEmploi,
  motifs: MotifPdf[],
  nomFichier: string,
): Promise<void> {
  const doc = await construireEmploiDuTempsPdf(e, motifs);
  doc.save(nomFichier);
}
