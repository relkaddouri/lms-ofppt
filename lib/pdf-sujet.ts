import { jsPDF } from "jspdf";
import type { Marque } from "@/lib/pdf-marque";
import { COULEURS, installerPolices, police } from "@/lib/pdf-theme";
import { dessinerCartouche, LARGEUR, X } from "@/lib/pdf-cartouche";
import { insecable } from "@/lib/typographie";
import type { Identification } from "@/lib/resultat";

/**
 * Le sujet d'un contrôle, sous ses trois formes imprimées (PRD §4.7, §4.7bis).
 *
 * - **Le sujet du stagiaire** : ce qu'on distribue le jour de l'épreuve. Il
 *   porte, sous le cartouche, la place pour le nom, le CEF, le CNE et la note.
 * - **Le sujet à viser** : le même énoncé, sans rien à remplir, que le chef de
 *   pôle cachette page par page avant l'épreuve.
 * - **Le corrigé** : le même énoncé, avec les bonnes propositions cochées et
 *   la réponse attendue à la place de l'espace de composition.
 *
 * Un seul dessin pour les trois : le formateur qui corrige doit retrouver ses
 * questions exactement là où les stagiaires les ont lues.
 *
 * Il remplace l'ancien gabarit encadré, qui ne reprenait pas le cartouche des
 * autres pièces du dossier et donnait la même place — quelques lignes — à une
 * restitution à 1 point et à un exercice de production à 4 points.
 */

export type QuestionSujet = {
  /** « qcm », « ouverte » ou « exercice ». */
  type: string;
  enonce: string;
  bareme: number;
  /** Les propositions d'un QCM. `correcte` ne sert qu'au corrigé. */
  options: { texte: string; correcte?: boolean }[];
  /** La réponse attendue ; imprimée seulement dans le corrigé. */
  corrige?: string | null;
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

export type VarianteSujet = "stagiaire" | "visa" | "corrige";

const HAUT = 20;
/** Sous cette ordonnée plus rien : le pied de page a besoin de sa place. */
const BAS = 272;
const INTERLIGNE_REPONSE = 7.5;

/**
 * Les énoncés produits par l'IA commencent souvent par « 3. Question courte
 * (3 points) : ». Le numéro et le barème sont déjà portés par la mise en page.
 */
export function nettoieEnonce(enonce: string): string {
  return enonce
    .replace(/^\s*\d+\s*[.)]\s*/, "")
    .replace(/\(\s*\d+(?:[.,]\d+)?\s*points?\s*\)\s*:?\s*/i, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/**
 * La place pour composer, proportionnée à ce que la question demande.
 *
 * Une question ouverte s'écrit : des lignes, plus nombreuses quand le barème
 * monte — une définition à 1 point n'appelle pas le paragraphe argumenté d'une
 * question à 4. Un exercice se pose : un cadre sans lignes, où l'on dessine
 * une cartographie ou une fiche persona aussi bien qu'on écrit. Un QCM se
 * coche, et n'a besoin de rien d'autre.
 */
export function placeDeReponse(q: Pick<QuestionSujet, "type" | "bareme">): {
  lignes: number;
  cadre: number;
} {
  const b = Math.max(0.5, Number(q.bareme) || 0);
  if (q.type === "qcm") return { lignes: 0, cadre: 0 };
  if (q.type === "exercice") {
    return {
      lignes: 0,
      cadre: Math.min(190, Math.max(60, Math.round(b * 20))),
    };
  }
  return {
    lignes: Math.min(16, Math.max(4, Math.round(b * 2.5 + 2))),
    cadre: 0,
  };
}

export function dessinerSujet(
  doc: jsPDF,
  s: Sujet,
  marque?: Marque,
  variante: VarianteSujet = "visa",
): void {
  const corrige = variante === "corrige";

  let y = dessinerCartouche(
    doc,
    {
      titre: corrige ? "Corrigé" : "Sujet d'épreuve",
      nature: s.nature,
      epreuve: s.titre,
      mention: `${s.questions.length} question${s.questions.length > 1 ? "s" : ""} · ${s.total} points${corrige ? " · document du formateur" : ""}`,
      identification: s.identification,
    },
    marque,
  );

  /** Ouvre une page et rend l'ordonnée de départ. */
  const suivante = () => {
    doc.addPage();
    return HAUT;
  };

  // ── Le candidat ──────────────────────────────────────────────────────────
  //
  // Sur le sujet distribué seulement : la copie doit dire à qui elle
  // appartient avant qu'on la retourne. Le CEF et le CNE à côté du nom, comme
  // sur le résultat signé qui en sortira — les deux documents se rapprochent
  // sur les mêmes codes.
  if (variante === "stagiaire") {
    const h = 24;
    doc.setDrawColor(...COULEURS.bordureForte).setLineWidth(0.3);
    doc.roundedRect(X, y, LARGEUR, h, 2, 2, "S");

    const champ = (libelle: string, x: number, yy: number, largeur: number) => {
      police(doc, "mono", 6.8);
      doc.setTextColor(...COULEURS.ardoiseClaire);
      doc.text(libelle.toLocaleUpperCase("fr"), x, yy);
      doc.setDrawColor(...COULEURS.bordureForte).setLineWidth(0.25);
      doc.line(x, yy + 6.5, x + largeur, yy + 6.5);
    };
    const largeurNote = 36;
    champ("Nom et prénom", X + 5, y + 6, LARGEUR - largeurNote - 17);
    champ("CEF", X + 5, y + 16, 58);
    champ("CNE", X + 70, y + 16, LARGEUR - largeurNote - 82);

    // La note : un cadre à part, à droite, que le correcteur remplit.
    const xn = X + LARGEUR - largeurNote;
    doc.setFillColor(...COULEURS.lavis);
    doc.roundedRect(xn, y, largeurNote, h, 2, 2, "F");
    police(doc, "mono", 6.8);
    doc.setTextColor(...COULEURS.ardoiseClaire);
    doc.text("NOTE", xn + largeurNote / 2, y + 6, { align: "center" });
    police(doc, "titre", 13);
    doc.setTextColor(...COULEURS.encre);
    doc.text(`/ ${s.total}`, xn + largeurNote / 2 + 6, y + 17.5, {
      align: "center",
    });
    y += h + 7;
  }

  // ── Les consignes ────────────────────────────────────────────────────────
  if (s.consignes?.trim()) {
    police(doc, "corps", 9);
    const lignes: string[] = doc.splitTextToSize(
      insecable(s.consignes.trim()),
      LARGEUR - 12,
    );
    const hauteur = 9 + lignes.length * 4.4;
    if (y + hauteur > BAS) y = suivante();
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
    y += hauteur + 9;
  }

  // ── Les questions ────────────────────────────────────────────────────────
  s.questions.forEach((q, i) => {
    police(doc, "corpsGras", 10);
    const enonce: string[] = doc.splitTextToSize(
      insecable(nettoieEnonce(q.enonce)),
      LARGEUR - 42,
    );

    police(doc, "corps", 9.5);
    const options = q.options.map((o) => ({
      lignes: doc.splitTextToSize(insecable(o.texte), LARGEUR - 24) as string[],
      correcte: Boolean(o.correcte),
    }));
    const hauteurOptions = options.reduce(
      (t, o) => t + Math.max(6.4, o.lignes.length * 4.6 + 1.8),
      0,
    );

    // Dans le corrigé, la réponse attendue prend la place de la composition.
    police(doc, "corps", 9);
    const attendu: string[] =
      corrige && q.type !== "qcm" && q.corrige?.trim()
        ? doc.splitTextToSize(insecable(q.corrige.trim()), LARGEUR - 22)
        : [];
    const hauteurAttendu = attendu.length > 0 ? 12 + attendu.length * 4.4 : 0;

    const place = corrige ? { lignes: 0, cadre: 0 } : placeDeReponse(q);
    const hauteurEnonce = enonce.length * 5 + 5;
    const hauteurReponse =
      place.lignes * INTERLIGNE_REPONSE +
      (place.cadre > 0 ? place.cadre + 3 : 0);
    const hauteurTotale =
      hauteurEnonce + hauteurOptions + hauteurAttendu + hauteurReponse + 10;

    // Une question ne se coupe jamais entre deux pages. Si elle ne tient pas
    // dans ce qui reste, elle part entière sur la suivante ; si elle ne tient
    // pas même sur une page vierge — un exercice très long —, c'est sa place
    // de composition qui se resserre, jamais l'énoncé qui se sépare de ses
    // lignes.
    if (y + hauteurTotale > BAS && y > HAUT + 1) y = suivante();
    const disponible = BAS - y;
    const excedent = Math.max(0, hauteurTotale - disponible);
    let lignesReponse = place.lignes;
    let cadre = place.cadre;
    if (excedent > 0) {
      if (cadre > 0) cadre = Math.max(40, cadre - excedent);
      else
        lignesReponse = Math.max(
          3,
          lignesReponse - Math.ceil(excedent / INTERLIGNE_REPONSE),
        );
    }

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

    const bareme = `${String(q.bareme).replace(".", ",")} ${q.bareme > 1 ? "pts" : "pt"}`;
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
    y += hauteurEnonce;

    // ── Les propositions d'un QCM ──────────────────────────────────────────
    //
    // L'ordre est celui de la saisie, jamais mélangé : deux exemplaires d'un
    // même sujet doivent être identiques, et le corrigé doit se lire à côté.
    options.forEach((o) => {
      const coche = corrige && o.correcte;
      doc.setDrawColor(...(coche ? COULEURS.vert : COULEURS.bordureForte));
      doc.setLineWidth(coche ? 0.5 : 0.3);
      doc.rect(X + 11, y - 3, 4, 4);
      if (coche) {
        doc.setDrawColor(...COULEURS.vert).setLineWidth(0.6);
        doc.line(X + 11.8, y - 1, X + 12.8, y + 0.2);
        doc.line(X + 12.8, y + 0.2, X + 14.3, y - 2.3);
      }
      police(doc, coche ? "corpsGras" : "corps", 9.5);
      doc.setTextColor(...(coche ? COULEURS.encre : COULEURS.corps));
      o.lignes.forEach((l, k) => doc.text(l, X + 18, y + k * 4.6));
      y += Math.max(6.4, o.lignes.length * 4.6 + 1.8);
    });

    // ── La réponse attendue (corrigé) ──────────────────────────────────────
    if (attendu.length > 0) {
      y += 2;
      doc.setFillColor(233, 242, 247);
      doc.roundedRect(
        X + 10,
        y - 3,
        LARGEUR - 10,
        hauteurAttendu - 2,
        1.5,
        1.5,
        "F",
      );
      doc.setFillColor(...COULEURS.sarcelle);
      doc.rect(X + 10, y - 3, 0.9, hauteurAttendu - 2, "F");
      police(doc, "mono", 6.8);
      doc.setTextColor(...COULEURS.sarcelle);
      doc.text("RÉPONSE ATTENDUE", X + 14, y + 2);
      police(doc, "corps", 9);
      doc.setTextColor(...COULEURS.corps);
      attendu.forEach((l, k) => doc.text(l, X + 14, y + 7.5 + k * 4.4));
      y += hauteurAttendu;
    }

    // ── La place pour composer ─────────────────────────────────────────────
    if (lignesReponse > 0) {
      for (let k = 0; k < lignesReponse; k++) {
        y += INTERLIGNE_REPONSE;
        doc.setDrawColor(...COULEURS.separateur).setLineWidth(0.25);
        doc.line(X + 10, y - 1.5, X + LARGEUR, y - 1.5);
      }
    }
    if (cadre > 0) {
      y += 2;
      doc.setDrawColor(...COULEURS.bordureForte).setLineWidth(0.3);
      doc.roundedRect(X + 10, y, LARGEUR - 10, cadre, 1.5, 1.5, "S");
      y += cadre + 1;
    }
    y += 10;
  });

  // ── Pied de page ─────────────────────────────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    police(doc, "corps", 7.5);
    doc.setTextColor(...COULEURS.muet);
    const libelle = corrige ? "Corrigé" : "Sujet";
    doc.text(`${libelle} — ${s.titre}`, X, 289, { maxWidth: LARGEUR - 60 });
    doc.text(`Page ${p} / ${pages}`, X + LARGEUR, 289, { align: "right" });

    police(doc, "mono", 6.8);
    doc.setTextColor(...COULEURS.ardoiseClaire);
    if (variante === "visa") {
      // Le rappel du visa sur chaque page, parce que c'est page par page qu'il
      // s'appose : une page non cachetée ne fait pas partie du sujet visé.
      doc.text("VISA DU CHEF DE PÔLE — CACHET SUR CHAQUE PAGE", X, 284);
    } else if (variante === "stagiaire" && p > 1) {
      // Une feuille détachée doit encore dire à qui elle appartient.
      doc.text("NOM ET CEF :", X, 284);
      doc.setDrawColor(...COULEURS.bordureForte).setLineWidth(0.2);
      doc.line(X + 20, 284.5, X + 110, 284.5);
    } else if (corrige) {
      doc.text("DOCUMENT DU FORMATEUR — NE PAS DISTRIBUER", X, 284);
    }
  }
}

export async function construireSujetPdf(
  s: Sujet,
  marque?: Marque,
  variante: VarianteSujet = "visa",
): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  await installerPolices(doc);
  dessinerSujet(doc, s, marque, variante);
  return doc;
}

export async function telechargerSujetPdf(
  s: Sujet,
  nomFichier: string,
  marque?: Marque,
  variante: VarianteSujet = "visa",
): Promise<void> {
  const doc = await construireSujetPdf(s, marque, variante);
  doc.save(nomFichier);
}
