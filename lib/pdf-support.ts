import type jsPDF from "jspdf";
import { dessinerEntete, type Marque } from "@/lib/pdf-marque";
import type { Support } from "@/lib/support";
import { COULEURS, installerPolices, police } from "@/lib/pdf-theme";

/**
 * Support remis au stagiaire.
 *
 * Deux mises en page selon la nature : un cours se lit et s'annote, un énoncé
 * de TP se suit en travaillant. Le premier laisse une marge pour les notes, le
 * second met le livrable et le barème en évidence.
 */

export type EnteteSupport = {
  moduleNom: string;
  groupeNom: string;
  date: string | null;
  dureeHeures: number | null;
  objectif: string | null;
};

export const X = 16;
export const LARGEUR = 178;
export const HAUT = 20;
export const BAS = 278;

// Les quatre gris maison ont laissé place à la palette du design system : la
// même que les écrans, définie une seule fois (lib/pdf-theme.ts).
export const ENCRE = COULEURS.encre;
export const CORPS = COULEURS.corps;
export const GRIS = COULEURS.ardoise;
export const TRAIT = COULEURS.bordureForte;
export const FOND = COULEURS.lavis;

export async function construireSupportPdf(
  support: Support,
  entete: EnteteSupport,
  marque?: Marque,
): Promise<jsPDF> {
  const { default: JsPDF } = await import("jspdf");
  const doc = new JsPDF({ unit: "mm", format: "a4" });
  await installerPolices(doc);
  const y = dessinerEntete(doc, marque, X, HAUT, LARGEUR);

  dessinerSupport(doc, support, entete, y);
  numeroterPages(doc, `${entete.moduleNom} — ${entete.groupeNom}`);
  return doc;
}

/**
 * Le corps d'un support, dessiné à partir d'une ordonnée donnée.
 *
 * Exporté parce que la compilation d'un module (PRD §4.4) enchaîne plusieurs
 * supports dans un même document : réécrire ce rendu là-bas produirait deux
 * mises en page du même contenu, qui divergeraient à la première retouche.
 * Renvoie l'ordonnée atteinte.
 */
export function dessinerSupport(
  doc: jsPDF,
  support: Support,
  entete: EnteteSupport,
  depart: number,
): number {
  let y = depart;

  const place = (h: number) => {
    if (y + h > BAS) {
      doc.addPage();
      y = HAUT;
    }
  };

  function texte(t: string, taille = 9.5, indent = 0, gris = false) {
    police(doc, "corps", taille);
    doc.setTextColor(...(gris ? GRIS : CORPS));
    for (const l of doc.splitTextToSize(t, LARGEUR - indent)) {
      place(6);
      doc.text(l, X + indent, y);
      y += taille * 0.45;
    }
  }

  /**
   * Les ressources en fin de document (PRD §4.4).
   *
   * Un lien mort n'est pas imprimé : le stagiaire ne peut pas le corriger, et
   * une URL qui ne répond pas sur une feuille de papier est une impasse.
   */
  function ressources() {
    const vivantes = (support.ressources ?? []).filter(
      (r) => r.joignable !== false,
    );
    if (vivantes.length === 0) return;
    titre("Pour aller plus loin", 11);
    for (const r of vivantes) {
      puce(
        [r.titre, r.pourquoi || null, r.url || null]
          .filter(Boolean)
          .join(" — "),
      );
    }
  }

  function titre(t: string, taille = 12, avant = 7) {
    y += avant;
    place(10);
    police(doc, "titre", taille);
    doc.setTextColor(...ENCRE);
    for (const l of doc.splitTextToSize(t, LARGEUR)) {
      doc.text(l, X, y);
      y += taille * 0.5;
    }
    y += 1;
  }

  function puce(t: string, indent = 5) {
    police(doc, "corps", 9.5);
    doc.setTextColor(...CORPS);
    const lignes = doc.splitTextToSize(t, LARGEUR - indent - 4);
    lignes.forEach((l: string, i: number) => {
      place(6);
      if (i === 0) doc.text("•", X + indent, y);
      doc.text(l, X + indent + 4, y);
      y += 4.3;
    });
  }

  // ── En-tête commun ──────────────────────────────────────────────────────
  police(doc, "titre", 15);
  doc.setTextColor(...ENCRE);
  const lignesTitre = doc.splitTextToSize(support.titre, LARGEUR);
  lignesTitre.forEach((l: string, i: number) => doc.text(l, X, y + i * 6.5));
  y += lignesTitre.length * 6.5 + 2;

  police(doc, "corps", 8.5);
  doc.setTextColor(...GRIS);
  doc.text(
    [
      entete.moduleNom,
      entete.groupeNom,
      entete.date,
      entete.dureeHeures ? `${entete.dureeHeures} h` : null,
      support.type === "pratique" ? "Travaux pratiques" : "Cours",
    ]
      .filter(Boolean)
      .join("  ·  "),
    X,
    y,
  );
  y += 4;
  doc.setDrawColor(...TRAIT).setLineWidth(0.3);
  doc.line(X, y, X + LARGEUR, y);
  y += 4;

  if (support.type === "theorique") {
    if (support.introduction) {
      texte(support.introduction, 10);
      y += 2;
    }
    support.sections.forEach((sec, i) => {
      titre(`${i + 1}. ${sec.titre}`, 11);
      for (const n of sec.notions) puce(n);
      // La figure se rend en une ligne d'étapes fléchées : c'est la même
      // information qu'à l'écran, dans un document qui s'imprime en noir.
      if (sec.schema) {
        y += 2;
        titre(sec.schema.titre, 9, 2);
        puce(sec.schema.etapes.join("  →  "));
        if (sec.schema.legende) puce(sec.schema.legende);
      }
      if (sec.exemple) {
        y += 2;
        const lignes = doc.splitTextToSize(sec.exemple, LARGEUR - 10);
        const h = lignes.length * 4.3 + 7;
        place(h);
        doc.setFillColor(...FOND);
        doc.rect(X, y - 3, LARGEUR, h, "F");
        police(doc, "titre", 8);
        doc.setTextColor(...GRIS);
        doc.text("EXEMPLE", X + 4, y + 1);
        police(doc, "corps", 9);
        doc.setTextColor(...ENCRE);
        lignes.forEach((l: string, k: number) =>
          doc.text(l, X + 4, y + 5.5 + k * 4.3),
        );
        y += h;
      }
    });

    if (support.aRetenir.length > 0) {
      titre("À retenir", 11);
      for (const r of support.aRetenir) puce(r);
    }

    ressources();
  } else {
    titre("Contexte", 11, 2);
    texte(support.contexte, 9.5);

    titre("Objectif", 11);
    texte(support.objectif, 9.5);

    titre("Travail demandé", 11);
    support.consignes.forEach((c, i) => {
      police(doc, "corps", 9.5);
      doc.setTextColor(...ENCRE);
      const lignes = doc.splitTextToSize(c, LARGEUR - 10);
      lignes.forEach((l: string, k: number) => {
        place(6);
        if (k === 0) {
          police(doc, "corpsGras");
          doc.text(`${i + 1}.`, X + 2, y);
          police(doc, "corps");
        }
        doc.text(l, X + 10, y);
        y += 4.5;
      });
      y += 1;
    });

    // Le livrable est ce que le stagiaire oublie le plus : il est encadré.
    y += 3;
    const lignesLivrable = doc.splitTextToSize(support.livrable, LARGEUR - 8);
    const hLivrable = lignesLivrable.length * 4.3 + 10;
    place(hLivrable);
    doc.setDrawColor(...ENCRE).setLineWidth(0.5);
    doc.rect(X, y, LARGEUR, hLivrable);
    police(doc, "titre", 8.5);
    doc.setTextColor(...GRIS);
    doc.text("LIVRABLE ATTENDU", X + 4, y + 5);
    police(doc, "corps", 9.5);
    doc.setTextColor(...ENCRE);
    lignesLivrable.forEach((l: string, k: number) =>
      doc.text(l, X + 4, y + 10.5 + k * 4.3),
    );
    y += hLivrable;

    if (support.criteres.length > 0) {
      titre("Critères d'évaluation", 11);
      const lPoints = 24;
      for (const c of support.criteres) {
        doc.setFontSize(9.5);
        const lignes = doc.splitTextToSize(c.critere, LARGEUR - lPoints - 4);
        const h = Math.max(7, lignes.length * 4.3 + 2.5);
        place(h);
        doc.setDrawColor(...TRAIT).setLineWidth(0.2);
        doc.rect(X, y, LARGEUR - lPoints, h);
        doc.rect(X + LARGEUR - lPoints, y, lPoints, h);
        police(doc, "corps");
        doc.setTextColor(...ENCRE);
        lignes.forEach((l: string, k: number) =>
          doc.text(l, X + 2, y + 4.5 + k * 4.3),
        );
        police(doc, "corpsGras");
        doc.text(
          `${c.points} pts`,
          X + LARGEUR - lPoints / 2,
          y + h / 2 + 1.5,
          { align: "center" },
        );
        y += h;
      }
      const total = support.criteres.reduce((t, c) => t + c.points, 0);
      place(8);
      doc.setFillColor(...FOND);
      doc.rect(X, y, LARGEUR, 8, "F");
      doc.setDrawColor(...TRAIT).rect(X, y, LARGEUR, 8);
      police(doc, "titre", 9.5);
      doc.setTextColor(...ENCRE);
      doc.text("Total", X + 2, y + 5.5);
      doc.text(`${total} pts`, X + LARGEUR - lPoints / 2, y + 5.5, {
        align: "center",
      });
      y += 8;
    }

    ressources();
  }

  return y;
}

/** Le pied de page, posé une fois le document complet. */
export function numeroterPages(doc: jsPDF, libelle: string) {
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    police(doc, "corps", 7.5);
    doc.setTextColor(...GRIS);
    doc.text(libelle, X, 287, { maxWidth: LARGEUR - 25 });
    doc.text(`Page ${p} / ${pages}`, X + LARGEUR, 287, { align: "right" });
  }
}

export async function telechargerSupportPdf(
  support: Support,
  entete: EnteteSupport,
  nomFichier: string,
  marque?: Marque,
) {
  const doc = await construireSupportPdf(support, entete, marque);
  doc.save(nomFichier);
}
