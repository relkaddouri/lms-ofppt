import type jsPDF from "jspdf";
import { dessinerEntete, type Marque } from "@/lib/pdf-marque";
import { JOURS } from "@/lib/motifs";
import { CRENEAUX_JOUR, positionSeance } from "@/lib/creneaux";
import { COULEURS_GROUPE_RVB, rangGroupe } from "@/lib/couleurs-groupe";

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
  /** Sert à retrouver la couleur du groupe, la même qu'à l'écran. */
  groupeId: string;
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
/** Hauteur d'une ligne de créneau, la même pour les quatre. */
const H_LIGNE = 11;

function dessinerMotif(doc: jsPDF, m: MotifPdf, y: number): number {
  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...ENCRE);
  doc.text(m.libelle?.trim() || "Rythme hebdomadaire", X, y);
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...GRIS);
  doc.text(periode(m), X + LARGEUR, y, { align: "right" });
  y += 4;

  // Quatre lignes fixes de 2 h 30 : un créneau de 5 h occupe deux lignes d'un
  // seul tenant, il n'a pas sa propre rangée. Prendre les créneaux déclarés
  // comme lignes donnait la même hauteur à 2 h 30 et à 5 h — la grille
  // affichée au mur ne se lisait plus.
  const places = new Map<string, { creneau: CreneauPdf; span: number }[]>();
  for (const c of m.creneaux) {
    const pos = positionSeance(c.heure_debut, c.heure_fin);
    if (!pos) continue;
    const cle = `${c.jour_semaine}|${pos.index}`;
    places.set(cle, [...(places.get(cle) ?? []), { creneau: c, span: pos.span }]);
  }

  if (m.creneaux.length === 0) {
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

  // ── Le cadre : quatre lignes, colonnes des jours ────────────────────
  const yGrille = y;
  const hTotale = CRENEAUX_JOUR.length * H_LIGNE;

  doc.setDrawColor(...TRAIT).setLineWidth(0.2);
  CRENEAUX_JOUR.forEach((c, i) => {
    const yl = yGrille + i * H_LIGNE;
    doc.rect(X, yl, LARGEUR, H_LIGNE);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...ENCRE);
    doc.text(heure(c.debut), X + 2, yl + 4.6);
    doc.text(heure(c.fin), X + 2, yl + 8.4);
  });
  doc.line(X + L_CRENEAU, yGrille, X + L_CRENEAU, yGrille + hTotale);
  JOURS.forEach((_, i) => {
    const xCase = X + L_CRENEAU + i * L_JOUR;
    doc.line(xCase, yGrille, xCase, yGrille + hTotale);
  });

  // ── Les cases occupées, d'un seul tenant sur leur hauteur réelle ────
  JOURS.forEach((j, i) => {
    const xCase = X + L_CRENEAU + i * L_JOUR;
    CRENEAUX_JOUR.forEach((_, ligne) => {
      const ici = places.get(`${j.valeur}|${ligne}`) ?? [];
      if (ici.length === 0) return;

      const span = ici.reduce((mx, x) => Math.max(mx, x.span), 1);
      const yc = yGrille + ligne * H_LIGNE;
      const hc = span * H_LIGNE;

      // La case porte la couleur de son groupe — la même palette qu'à l'écran
      // (design_system.md §5.4) — et se referme sur toute sa hauteur : un bloc
      // de 5 h doit se voir deux fois plus haut qu'un bloc de 2 h 30.
      const couleur = COULEURS_GROUPE_RVB[rangGroupe(ici[0].creneau.groupeId)];
      doc.setFillColor(...couleur.fond);
      doc.rect(xCase + 0.4, yc + 0.4, L_JOUR - 0.8, hc - 0.8, "F");
      doc.setDrawColor(...couleur.trait).setLineWidth(0.3);
      doc.rect(xCase + 0.4, yc + 0.4, L_JOUR - 0.8, hc - 0.8);

      doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...couleur.trait);
      const noms = doc.splitTextToSize(
        ici.map((x) => x.creneau.groupeNom).join(" · "),
        L_JOUR - 3,
      ) as string[];
      const lignesTexte = [...noms.slice(0, 3)];
      const haut = yc + (hc - lignesTexte.length * 3.4) / 2 + 2.6;
      doc.text(lignesTexte, xCase + L_JOUR / 2, haut, { align: "center" });

      if (span > 1) {
        doc.setFont("helvetica", "normal").setFontSize(6.5);
        doc.setTextColor(...couleur.trait);
        doc.text(`${span * 2.5} h`, xCase + L_JOUR / 2, haut + 4.4, {
          align: "center",
        });
      }
    });
  });

  return yGrille + hTotale;
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
    const hauteur = 12 + CRENEAUX_JOUR.length * H_LIGNE;
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
