import type jsPDF from "jspdf";
import { dessinerEntete, type Marque } from "@/lib/pdf-marque";

/**
 * Copie corrigée d'un contrôle, en vectoriel.
 *
 * Remplace l'export par capture d'écran : celui-ci produisait une image
 * collée dans un PDF — texte flou, non sélectionnable, non recherchable, et
 * un fichier lourd. Une copie est un document d'archive : elle doit rester
 * lisible et exploitable.
 */

export type QuestionCopie = {
  enonce: string;
  bareme: number;
  points: number;
  commentaire?: string;
  reponse?: string;
  corrige?: string;
};

export type Copie = {
  titre: string;
  stagiaire: string;
  email?: string | null;
  /** Groupe et module, quand on les connaît. */
  contexte?: string | null;
  dateRemise?: string | null;
  note: number;
  total: number;
  questions: QuestionCopie[];
  /** Le corrigé n'est joint que pour le formateur, jamais pour le stagiaire. */
  avecCorrige: boolean;
};

const X = 14;
const LARGEUR = 182;
const HAUT = 18;
const BAS = 280;

const ENCRE: [number, number, number] = [17, 24, 39];
const GRIS: [number, number, number] = [110, 116, 126];
const TRAIT: [number, number, number] = [200, 203, 208];

export async function construireCopiePdf(
  c: Copie,
  marque?: Marque,
): Promise<jsPDF> {
  const { default: JsPDF } = await import("jspdf");
  const doc = new JsPDF({ unit: "mm", format: "a4" });
  // Une copie corrigée est un document d'archive : elle porte l'identité du
  // centre au même titre que le contrôle dont elle sort.
  let y = dessinerEntete(doc, marque, X, HAUT, LARGEUR);

  function place(hauteur: number) {
    if (y + hauteur > BAS) {
      doc.addPage();
      y = HAUT;
    }
  }

  function paragraphe(texte: string, taille = 9, gris = false, indent = 0) {
    doc.setFont("helvetica", "normal").setFontSize(taille);
    doc.setTextColor(...(gris ? GRIS : ENCRE));
    const lignes = doc.splitTextToSize(texte, LARGEUR - indent);
    for (const l of lignes) {
      place(5);
      doc.text(l, X + indent, y);
      y += taille * 0.42 + 0.8;
    }
  }

  // ── En-tête ──────────────────────────────────────────────────────────────
  // Le titre peut tenir sur plusieurs lignes : on mesure au lieu de supposer,
  // sinon la ligne d'identification vient se poser par-dessus.
  doc.setFont("helvetica", "bold").setFontSize(14).setTextColor(...ENCRE);
  const lignesTitre = doc.splitTextToSize(c.titre, LARGEUR - 46);
  lignesTitre.forEach((l: string, i: number) => doc.text(l, X, y + i * 6));
  y += lignesTitre.length * 6 + 2;

  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...GRIS);
  const meta = [
    c.stagiaire,
    c.contexte ?? null,
    c.dateRemise ? `Remis le ${c.dateRemise}` : null,
  ].filter(Boolean) as string[];
  doc.text(meta.join("  ·  "), X, y);
  y += 6;

  // Bloc de note, aligné à droite comme sur un sujet officiel.
  const largeurNote = 40;
  const xNote = X + LARGEUR - largeurNote;
  doc.setDrawColor(...TRAIT).setLineWidth(0.4);
  doc.rect(xNote, HAUT - 5, largeurNote, 16);
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...GRIS);
  doc.text("Note", xNote + largeurNote / 2, HAUT - 0.5, { align: "center" });
  doc.setFont("helvetica", "bold").setFontSize(14).setTextColor(...ENCRE);
  doc.text(
    `${c.note.toLocaleString("fr-FR")} / ${c.total}`,
    xNote + largeurNote / 2,
    HAUT + 7,
    { align: "center" },
  );

  y += 2;
  doc.setDrawColor(...TRAIT).setLineWidth(0.3);
  doc.line(X, y, X + LARGEUR, y);
  y += 7;

  // ── Questions ────────────────────────────────────────────────────────────
  c.questions.forEach((q, i) => {
    place(20);

    doc.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(...ENCRE);
    const entete = `Question ${i + 1}`;
    doc.text(entete, X, y);
    doc
      .setFont("helvetica", "bold")
      .setTextColor(...ENCRE)
      .text(
        `${q.points.toLocaleString("fr-FR")} / ${q.bareme}`,
        X + LARGEUR,
        y,
        { align: "right" },
      );
    y += 5;

    paragraphe(q.enonce, 9);
    y += 1.5;

    if (q.reponse?.trim()) {
      paragraphe("Réponse du stagiaire", 8, true);
      paragraphe(q.reponse, 9, false, 4);
      y += 1;
    }
    if (c.avecCorrige && q.corrige?.trim()) {
      paragraphe("Corrigé attendu", 8, true);
      paragraphe(q.corrige, 9, false, 4);
      y += 1;
    }
    if (q.commentaire?.trim()) {
      paragraphe("Appréciation", 8, true);
      paragraphe(q.commentaire, 9, false, 4);
    }

    y += 4;
    place(4);
    doc.setDrawColor(...TRAIT).setLineWidth(0.2);
    doc.line(X, y, X + LARGEUR, y);
    y += 6;
  });

  // ── Pied de page sur chaque page ─────────────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...GRIS);
    doc.text(`${c.stagiaire} — ${c.titre}`, X, 289, { maxWidth: LARGEUR - 30 });
    doc.text(`Page ${p} / ${pages}`, X + LARGEUR, 289, { align: "right" });
  }

  return doc;
}

export async function telechargerCopiePdf(
  c: Copie,
  nomFichier: string,
  marque?: Marque,
) {
  const doc = await construireCopiePdf(c, marque);
  doc.save(nomFichier);
}
