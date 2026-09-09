import { jsPDF } from "jspdf";
import type { Marque } from "@/lib/pdf-marque";
import { COULEURS, installerPolices, police } from "@/lib/pdf-theme";
import { dessinerCartouche, LARGEUR, X } from "@/lib/pdf-cartouche";
import { insecable } from "@/lib/typographie";
import type { Identification } from "@/lib/resultat";

/**
 * Le sujet vierge d'un contrôle, à faire viser (PRD §4.7).
 *
 * Avant l'épreuve, le chef de pôle vise le sujet : il appose son cachet sur
 * chaque page de l'énoncé. C'est le cachet qui fait foi, page par page — d'où
 * l'absence de toute zone de signature à remplir, qui laisserait croire qu'une
 * seule paraphe en fin de document suffit.
 *
 * Le document ne porte donc que ce qui se vise : l'identification de
 * l'épreuve, les questions, leur barème, et la place pour composer. Ni
 * corrigé, ni nom de stagiaire, ni note — un sujet visé circule avant que rien
 * de tout cela n'existe.
 */

export type QuestionSujet = {
  /** « qcm », « ouverte » ou « exercice ». */
  type: string;
  enonce: string;
  bareme: number;
  /** Les propositions d'un QCM, à cocher. Vide pour les autres types. */
  options: { texte: string }[];
};

export type Sujet = {
  titre: string;
  nature: string;
  identification: Identification;
  consignes: string | null;
  questions: QuestionSujet[];
  /** Le total du barème, recalculé sur les questions. */
  total: number;
};

const HAUT = 20;
/** Sous cette ordonnée plus rien : le pied et le cachet ont besoin de place. */
const BAS = 262;

export function dessinerSujet(doc: jsPDF, s: Sujet, marque?: Marque): void {
  let y = dessinerCartouche(
    doc,
    {
      titre: "Sujet d'épreuve",
      nature: s.nature,
      epreuve: s.titre,
      mention: `${s.questions.length} question${s.questions.length > 1 ? "s" : ""} · ${s.total} points`,
      identification: s.identification,
    },
    marque,
  );

  /** Ouvre une page et rend l'ordonnée de départ. */
  const suivante = () => {
    doc.addPage();
    return HAUT;
  };

  // ── Les consignes ────────────────────────────────────────────────────────
  if (s.consignes?.trim()) {
    police(doc, "mono", 7);
    doc.setTextColor(...COULEURS.ardoiseClaire);
    doc.text("CONSIGNES", X + 4, y + 5.5);

    police(doc, "corps", 9);
    doc.setTextColor(...COULEURS.corps);
    const lignes: string[] = doc.splitTextToSize(
      insecable(s.consignes.trim()),
      LARGEUR - 12,
    );
    const hauteur = 9 + lignes.length * 4.4;
    doc.setFillColor(...COULEURS.papier);
    doc.setDrawColor(...COULEURS.bordure);
    doc.setLineWidth(0.3);
    doc.roundedRect(X, y, LARGEUR, hauteur, 2, 2, "FD");

    police(doc, "mono", 7);
    doc.setTextColor(...COULEURS.ardoiseClaire);
    doc.text("CONSIGNES", X + 5, y + 5.5);
    police(doc, "corps", 9);
    doc.setTextColor(...COULEURS.corps);
    lignes.forEach((l, i) => doc.text(l, X + 5, y + 10.5 + i * 4.4));
    y += hauteur + 8;
  }

  // ── Les questions ────────────────────────────────────────────────────────
  s.questions.forEach((q, i) => {
    police(doc, "corpsGras", 10);
    const enonce: string[] = doc.splitTextToSize(
      insecable(q.enonce),
      LARGEUR - 42,
    );

    // La place à laisser pour composer : un QCM se coche, une question
    // ouverte s'écrit, un exercice se pose. Le blanc n'est pas du vide, c'est
    // la copie du stagiaire.
    const hauteurOptions = q.options.length * 6.4;
    const lignesReponse =
      q.type === "qcm" ? 0 : q.type === "exercice" ? 12 : 5;
    const hauteurQuestion =
      enonce.length * 5 + 4 + hauteurOptions + lignesReponse * 6.5 + 8;

    if (y + Math.min(hauteurQuestion, BAS - HAUT) > BAS) y = suivante();

    // Numéro et barème, comme sur le résultat : les deux documents parlent de
    // la même question, ils la présentent pareil.
    doc.setFillColor(...COULEURS.encre);
    doc.roundedRect(X, y - 3.6, 7, 5.8, 1, 1, "F");
    police(doc, "mono", 7.5);
    doc.setTextColor(...COULEURS.blanc);
    doc.text(String(i + 1), X + 3.5, y + 0.5, { align: "center" });

    police(doc, "corpsGras", 10);
    doc.setTextColor(...COULEURS.encre);
    enonce.forEach((l, k) => doc.text(l, X + 10, y + k * 5));

    const bareme = `${q.bareme} ${q.bareme > 1 ? "pts" : "pt"}`;
    police(doc, "mono", 8.5);
    const largeurBareme = doc.getTextWidth(bareme) + 7;
    doc.setFillColor(...COULEURS.lavis);
    doc.roundedRect(
      X + LARGEUR - largeurBareme,
      y - 3.8,
      largeurBareme,
      6,
      1.2,
      1.2,
      "F",
    );
    doc.setTextColor(...COULEURS.encre);
    doc.text(bareme, X + LARGEUR - largeurBareme / 2, y + 0.6, {
      align: "center",
    });
    y += enonce.length * 5 + 4;

    // ── Les propositions d'un QCM ──────────────────────────────────────────
    //
    // Une case vide devant chacune : c'est un sujet, la bonne réponse ne s'y
    // trouve pas. L'ordre est celui de la saisie, jamais mélangé — deux
    // exemplaires d'un même sujet doivent être identiques.
    q.options.forEach((o) => {
      if (y + 6.4 > BAS) y = suivante();
      doc.setDrawColor(...COULEURS.bordureForte).setLineWidth(0.3);
      doc.rect(X + 11, y - 3, 4, 4);
      police(doc, "corps", 9.5);
      doc.setTextColor(...COULEURS.corps);
      const texte: string[] = doc.splitTextToSize(
        insecable(o.texte),
        LARGEUR - 22,
      );
      texte.forEach((l, k) => doc.text(l, X + 18, y + k * 4.6));
      y += Math.max(6.4, texte.length * 4.6 + 1.8);
    });

    // ── La place pour répondre ─────────────────────────────────────────────
    if (lignesReponse > 0) {
      for (let k = 0; k < lignesReponse; k++) {
        if (y + 6.5 > BAS) y = suivante();
        y += 6.5;
        doc.setDrawColor(...COULEURS.separateur).setLineWidth(0.2);
        doc.line(X + 10, y - 1.5, X + LARGEUR, y - 1.5);
      }
    }
    y += 8;
  });

  // ── Pied de page ─────────────────────────────────────────────────────────
  //
  // Le rappel du visa sur chaque page, parce que c'est page par page qu'il
  // s'appose : une page non cachetée ne fait pas partie du sujet visé.
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    police(doc, "corps", 7.5);
    doc.setTextColor(...COULEURS.muet);
    doc.text(`Sujet — ${s.titre}`, X, 289, { maxWidth: LARGEUR - 60 });
    doc.text(`Page ${p} / ${pages}`, X + LARGEUR, 289, { align: "right" });

    police(doc, "mono", 6.8);
    doc.setTextColor(...COULEURS.ardoiseClaire);
    doc.text("VISA DU CHEF DE PÔLE — CACHET SUR CHAQUE PAGE", X, 284);
  }
}

export async function telechargerSujetPdf(
  s: Sujet,
  nomFichier: string,
  marque?: Marque,
): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  await installerPolices(doc);
  dessinerSujet(doc, s, marque);
  doc.save(nomFichier);
}
