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
  /** Ce sur quoi la question travaille — tableau, extrait, cas —, en Markdown. */
  donnees?: string | null;
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

// ── Les données d'une question ─────────────────────────────────────────────
//
// Un exercice apporte avec lui ce sur quoi il travaille : observations,
// verbatims, tableau de relevés. Elles s'impriment sous l'énoncé, dans un
// cadre à part, pour qu'on sache ce qui est donné et ce qui est demandé.
//
// Le Markdown écrit par le formateur ou le modèle est réduit à ce qu'une page
// imprimée sait rendre : paragraphes, listes, et tableaux dessinés en grille —
// un tableau aplati en lignes de `|` serait illisible.

type BlocDonnees =
  | {
      genre: "texte";
      lignes: string[];
      puce: string;
      gras: boolean;
      hauteur: number;
    }
  | {
      genre: "tableau";
      lignes: string[][][];
      largeurs: number[];
      hauteurs: number[];
      hauteur: number;
    };

const INTERLIGNE_DONNEES = 4.3;
const RETRAIT_PUCE = 5;
/** Le libellé « DONNÉES » et l'air autour du contenu. */
const ENTETE_DONNEES = 6;
const PIED_DONNEES = 5;

export function hauteurDonnees(blocs: BlocDonnees[]): number {
  if (blocs.length === 0) return 0;
  return ENTETE_DONNEES + blocs.reduce((t, b) => t + b.hauteur, 0) + PIED_DONNEES;
}

/** Le Markdown en ligne ôté : l'emphase ne passe pas dans une ligne découpée. */
function texteBrut(t: string): string {
  return t
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/(?<![\p{L}\p{N}*])\*(?!\s)(.+?)\*(?![\p{L}\p{N}])/gu, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

const estLigneTableau = (l: string) => /^\s*\|.*\|\s*$/.test(l);
const estSeparateurTableau = (l: string) =>
  /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);

export function mesurerDonnees(
  doc: jsPDF,
  markdown: string,
  largeur: number,
): BlocDonnees[] {
  const blocs: BlocDonnees[] = [];
  const lignes = markdown.replace(/\r/g, "").split("\n");
  let i = 0;
  while (i < lignes.length) {
    const ligne = lignes[i];
    if (!ligne.trim()) {
      i++;
      continue;
    }

    if (estLigneTableau(ligne)) {
      const rangees: string[][] = [];
      while (i < lignes.length && estLigneTableau(lignes[i])) {
        if (!estSeparateurTableau(lignes[i])) {
          rangees.push(
            lignes[i]
              .trim()
              .replace(/^\|/, "")
              .replace(/\|$/, "")
              .split("|")
              .map((c) => texteBrut(c)),
          );
        }
        i++;
      }
      const colonnes = Math.max(...rangees.map((r) => r.length));
      // Chaque colonne reçoit une part proportionnée à son texte le plus long,
      // sans descendre sous un plancher : une colonne « N° » reste lisible.
      police(doc, "corps", 8.5);
      const poids = Array.from({ length: colonnes }, (_, c) =>
        Math.max(
          8,
          ...rangees.map((r) => Math.min(70, doc.getTextWidth(r[c] ?? ""))),
        ),
      );
      const somme = poids.reduce((a, b) => a + b, 0);
      const largeurs = poids.map((p) => (p / somme) * largeur);
      const cellules = rangees.map((r, k) =>
        largeurs.map((l, c) => {
          police(doc, k === 0 ? "corpsGras" : "corps", 8.5);
          return doc.splitTextToSize(insecable(r[c] ?? ""), l - 3) as string[];
        }),
      );
      const hauteurs = cellules.map(
        (r) => Math.max(...r.map((c) => c.length)) * 3.9 + 2.8,
      );
      blocs.push({
        genre: "tableau",
        lignes: cellules,
        largeurs,
        hauteurs,
        hauteur: hauteurs.reduce((a, b) => a + b, 0) + 2.5,
      });
      continue;
    }

    // Paragraphe ou élément de liste : les puces et numéros sont gardés tels
    // quels, en retrait, parce qu'on s'y réfère (« l'observation 3 »).
    const liste = ligne.match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
    const titre = ligne.match(/^\s*#{1,6}\s+(.*)$/);
    const puce = liste ? (/\d/.test(liste[1]) ? liste[1] : "–") : "";
    const contenu = texteBrut(liste ? liste[2] : titre ? titre[1] : ligne);
    police(doc, titre ? "corpsGras" : "corps", 9);
    const coupees: string[] = doc.splitTextToSize(
      insecable(contenu),
      largeur - (puce ? RETRAIT_PUCE : 0),
    );
    blocs.push({
      genre: "texte",
      lignes: coupees,
      puce,
      gras: Boolean(titre),
      hauteur: coupees.length * INTERLIGNE_DONNEES + 1.2,
    });
    i++;
  }
  return blocs;
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
    // Le bandeau à l'encre du résultat d'évaluation — « STAGIAIRE … NOTE » —
    // repris en tête, pour que sujet et résultat se reconnaissent l'un
    // l'autre ; mais ouvert en dessous, sur du blanc : ici on écrit à la main.
    const hBandeau = 8;
    const hChamps = 22;
    const largeurNote = 40;
    doc.setFillColor(...COULEURS.encre);
    doc.roundedRect(X, y, LARGEUR, hBandeau + 2, 1.5, 1.5, "F");
    doc.rect(X, y + hBandeau - 1, LARGEUR, 3, "F");
    police(doc, "mono", 7);
    doc.setTextColor(...COULEURS.blanc);
    doc.text("STAGIAIRE", X + 6, y + 5.4);
    doc.text("NOTE", X + LARGEUR - 6, y + 5.4, { align: "right" });

    doc.setDrawColor(...COULEURS.encre).setLineWidth(0.3);
    doc.rect(X, y + hBandeau + 1, LARGEUR, hChamps);
    doc.line(
      X + LARGEUR - largeurNote,
      y + hBandeau + 1,
      X + LARGEUR - largeurNote,
      y + hBandeau + 1 + hChamps,
    );

    const champ = (libelle: string, x: number, yy: number, largeur: number) => {
      police(doc, "mono", 6.5);
      doc.setTextColor(...COULEURS.ardoiseClaire);
      doc.text(libelle.toLocaleUpperCase("fr"), x, yy);
      doc.setDrawColor(...COULEURS.bordureForte).setLineWidth(0.25);
      doc.line(
        x + doc.getTextWidth(libelle.toLocaleUpperCase("fr")) + 2,
        yy + 0.6,
        x + largeur,
        yy + 0.6,
      );
    };
    const y0 = y + hBandeau + 1;
    const largeurChamps = LARGEUR - largeurNote - 12;
    champ("Nom et prénom", X + 6, y0 + 8, largeurChamps);
    champ("CEF", X + 6, y0 + 17, largeurChamps * 0.45);
    champ("CNE", X + 6 + largeurChamps * 0.52, y0 + 17, largeurChamps * 0.48);

    // La note, à l'endroit exact où le résultat l'affichera.
    police(doc, "titre", 14);
    doc.setTextColor(...COULEURS.encre);
    doc.text(`/ ${s.total}`, X + LARGEUR - 6, y0 + 14.5, { align: "right" });
    y += hBandeau + 1 + hChamps + 8;
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

    const donnees = q.donnees?.trim()
      ? mesurerDonnees(doc, q.donnees, LARGEUR - 14)
      : [];
    const hauteurDonneesQ = hauteurDonnees(donnees);

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
      hauteurEnonce +
      hauteurDonneesQ +
      hauteurOptions +
      hauteurAttendu +
      hauteurReponse +
      10;

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

    // ── Les données ────────────────────────────────────────────────────────
    //
    // Un filet à gauche plutôt qu'un cadre fermé : des données assez longues
    // pour passer sur la page suivante y continuent sans cadre ouvert à moitié.
    if (donnees.length > 0) {
      const xFilet = X + 10;
      const xTexte = X + 14;
      let debutFilet = y - 3;
      const filet = (fin: number) => {
        doc.setFillColor(...COULEURS.bordureForte);
        doc.rect(xFilet, debutFilet, 0.8, fin - debutFilet, "F");
      };
      const place = (h: number) => {
        if (y + h > BAS && y > HAUT + 1) {
          filet(y - 2);
          y = suivante();
          debutFilet = y - 3;
        }
      };

      police(doc, "mono", 6.8);
      doc.setTextColor(...COULEURS.ardoise);
      doc.text("DONNÉES", xTexte, y);
      y += ENTETE_DONNEES;

      for (const b of donnees) {
        if (b.genre === "texte") {
          place(b.hauteur);
          police(doc, b.gras ? "corpsGras" : "corps", 9);
          doc.setTextColor(...(b.gras ? COULEURS.encre : COULEURS.corps));
          const decalage = b.puce ? RETRAIT_PUCE : 0;
          if (b.puce) doc.text(b.puce, xTexte, y);
          b.lignes.forEach((l, k) =>
            doc.text(l, xTexte + decalage, y + k * INTERLIGNE_DONNEES),
          );
          y += b.hauteur;
          continue;
        }

        // Un tableau : l'en-tête sur fond lavé, une grille fine, et chaque
        // rangée entière sur une page.
        y -= 2.6;
        b.lignes.forEach((rangee, k) => {
          const h = b.hauteurs[k];
          place(h);
          let x = xTexte;
          rangee.forEach((cellule, c) => {
            const l = b.largeurs[c];
            if (k === 0) {
              doc.setFillColor(...COULEURS.lavis);
              doc.rect(x, y, l, h, "F");
            }
            doc.setDrawColor(...COULEURS.bordureForte).setLineWidth(0.2);
            doc.rect(x, y, l, h, "S");
            police(doc, k === 0 ? "corpsGras" : "corps", 8.5);
            doc.setTextColor(...(k === 0 ? COULEURS.encre : COULEURS.corps));
            cellule.forEach((t, n) => doc.text(t, x + 1.5, y + 3.9 + n * 3.9));
            x += l;
          });
          y += h;
        });
        y += 2.5 + 2.6;
      }
      y += 1;
      filet(y - 3);
      y += PIED_DONNEES - 1;
    }

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
