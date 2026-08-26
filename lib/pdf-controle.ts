import jsPDF from "jspdf";

/**
 * Sujet de contrôle, mise en page « document officiel ».
 *
 * Cadre sur toute la page, en-tête tripartite établissement / épreuve /
 * session, tableau d'identité encadré avec case de note réservée au correcteur,
 * questions numérotées en chiffres romains avec conduite de points vers le
 * barème. Le texte est écrit directement dans le PDF : la pagination se décide
 * question par question et le fichier pèse quelques kilo-octets.
 *
 * Police Helvetica, standard du format PDF. Embarquer General Sans alourdirait
 * le bundle client de plusieurs centaines de kilos pour un document imprimé ;
 * les couleurs, elles, sont celles du design system.
 */

export type OptionPdf = { texte: string; correcte?: boolean };

export type QuestionPdf = {
  type?: "qcm" | "ouverte" | "exercice";
  enonce: string;
  bareme: number;
  options?: OptionPdf[];
};

export type ControlePdf = {
  titre: string;
  moduleNom: string;
  moduleCode?: string | null;
  groupeNom?: string | null;
  specialiteNom?: string | null;
  type: "CC" | "EFM";
  typeEfm?: "local" | "regional" | null;
  format: "theorique" | "pratique" | "mixte";
  dureeHeures: number;
  datePrevue?: string | null;
  consignes?: string | null;
  questions: QuestionPdf[];
};

const PAGE_L = 210;
const PAGE_H = 297;
const CADRE_X = 12;
const CADRE_Y = 12;
const CADRE_L = PAGE_L - CADRE_X * 2;
const CADRE_H = PAGE_H - CADRE_Y * 2;
const PAD = 5;
const X = CADRE_X + PAD;
const LARGEUR = CADRE_L - PAD * 2;
const BAS_CONTENU = CADRE_Y + CADRE_H - 12;

const ENCRE: [number, number, number] = [22, 36, 31];
const ARDOISE: [number, number, number] = [107, 114, 128];
const TRAIT: [number, number, number] = [120, 128, 134];
const CLAIR: [number, number, number] = [205, 210, 214];
const PAPIER: [number, number, number] = [246, 247, 249];
const FORET: [number, number, number] = [14, 59, 46];

const LIBELLE_TYPE = { CC: "CONTRÔLE CONTINU", EFM: "ÉPREUVE DE FIN DE MODULE" } as const;
const LIBELLE_FORMAT = {
  theorique: "Théorique",
  pratique: "Pratique",
  mixte: "Théorique et pratique",
} as const;

const ROMAINS = [
  "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
  "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX",
];
const romain = (n: number) => ROMAINS[n - 1] ?? String(n);

/**
 * Les énoncés produits par l'IA commencent souvent par « 3. Question courte
 * (3 points) : ». Le numéro et le barème sont déjà portés par la mise en page.
 */
export function nettoieEnonce(enonce: string): string {
  return enonce
    .replace(/^\s*\d+\s*[.)]\s*/, "")
    .replace(/\(\s*\d+\s*points?\s*\)\s*:?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Sépare « QCM : Entourez… » en une nature courte et le corps de l'énoncé. */
function decoupeEnonce(enonce: string): { nature: string | null; corps: string } {
  const m = enonce.match(
    /^(QCM|Question courte|Questions courtes|Exercice d['’]application|Exercice|Étude de cas)\s*[:—–-]?\s*(.*)$/i,
  );
  if (m && m[2]) return { nature: m[1], corps: m[2] };
  return { nature: null, corps: enonce };
}

const heureFr = (n: number) =>
  `${n.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} h`;

export function construireControlePdf(c: ControlePdf): jsPDF {
  const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4", compress: true });
  doc.setFont("helvetica", "normal");

  const totalBareme = c.questions.reduce((s, q) => s + (Number(q.bareme) || 0), 0);
  const annee = (c.datePrevue ? new Date(c.datePrevue) : new Date()).getFullYear();
  let y = 0;

  // ------------------------------------------------------- cadre et en-tête
  const cadreEtEnTete = () => {
    doc.setDrawColor(...TRAIT).setLineWidth(0.5);
    doc.rect(CADRE_X, CADRE_Y, CADRE_L, CADRE_H);

    const hEnTete = 21;
    const c1 = CADRE_X + 74;
    const c2 = CADRE_X + 74 + 62;
    doc.setLineWidth(0.4);
    doc.line(CADRE_X, CADRE_Y + hEnTete, CADRE_X + CADRE_L, CADRE_Y + hEnTete);
    doc.line(c1, CADRE_Y, c1, CADRE_Y + hEnTete);
    doc.line(c2, CADRE_Y, c2, CADRE_Y + hEnTete);

    // Établissement
    doc.setTextColor(...ENCRE).setFont("helvetica", "bold").setFontSize(13);
    doc.text("OFPPT", CADRE_X + 4, CADRE_Y + 8);
    doc.setFont("helvetica", "normal").setFontSize(6.4).setTextColor(...ARDOISE);
    doc.text("Office de la Formation Professionnelle", CADRE_X + 4, CADRE_Y + 12.5);
    doc.text("et de la Promotion du Travail", CADRE_X + 4, CADRE_Y + 15.6);
    if (c.specialiteNom) {
      doc.setTextColor(...ENCRE).setFontSize(6.8);
      doc.text(doc.splitTextToSize(c.specialiteNom, 66)[0], CADRE_X + 4, CADRE_Y + 19);
    }

    // Épreuve
    const milieu = c1 + (c2 - c1) / 2;
    doc.setTextColor(...ENCRE).setFont("helvetica", "bold").setFontSize(10);
    for (const [i, ligne] of doc
      .splitTextToSize(LIBELLE_TYPE[c.type], c2 - c1 - 8)
      .entries()) {
      doc.text(ligne, milieu, CADRE_Y + 9 + i * 5, { align: "center" });
    }
    if (c.type === "EFM" && c.typeEfm) {
      doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(...ARDOISE);
      doc.text(
        c.typeEfm === "regional" ? "Régional" : "Local",
        milieu,
        CADRE_Y + 18,
        { align: "center" },
      );
    }

    // Session
    const x3 = c2 + 4;
    doc.setFont("helvetica", "normal").setFontSize(7.2).setTextColor(...ARDOISE);
    doc.text("Session", x3, CADRE_Y + 6);
    doc.text("Durée", x3, CADRE_Y + 12);
    doc.text("Barème", x3, CADRE_Y + 18);
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...ENCRE);
    const droite = CADRE_X + CADRE_L - 4;
    doc.text(String(annee), droite, CADRE_Y + 6, { align: "right" });
    doc.text(heureFr(c.dureeHeures), droite, CADRE_Y + 12, { align: "right" });
    doc.text(`${totalBareme} pts`, droite, CADRE_Y + 18, { align: "right" });
  };

  const pageSuivante = () => {
    doc.addPage();
    cadreEtEnTete();
    y = CADRE_Y + 21 + 8;
  };

  const assurerPlace = (besoin: number) => {
    if (y + besoin > BAS_CONTENU) pageSuivante();
  };

  cadreEtEnTete();
  y = CADRE_Y + 21;

  // --------------------------------------------------------- bandeau module
  doc.setFillColor(...PAPIER).setDrawColor(...TRAIT).setLineWidth(0.4);
  doc.rect(CADRE_X, y, CADRE_L, 13, "FD");
  doc.setTextColor(...ENCRE).setFont("helvetica", "bold").setFontSize(9.5);
  const intitule = c.moduleCode
    ? `${c.moduleCode} — ${c.moduleNom}`
    : c.moduleNom;
  doc.text(doc.splitTextToSize(intitule, LARGEUR)[0], PAGE_L / 2, y + 5.5, {
    align: "center",
  });
  doc.setFont("helvetica", "normal").setFontSize(7.4).setTextColor(...ARDOISE);
  doc.text(
    `Épreuve ${LIBELLE_FORMAT[c.format].toLowerCase()}${c.groupeNom ? ` · Groupe ${c.groupeNom}` : ""}`,
    PAGE_L / 2,
    y + 10,
    { align: "center" },
  );
  y += 13;

  // ------------------------------------------------------ tableau identité
  const hId = 20;
  const xNote = CADRE_X + CADRE_L - 30;
  doc.setDrawColor(...TRAIT).setLineWidth(0.4);
  doc.line(CADRE_X, y + hId, CADRE_X + CADRE_L, y + hId);
  doc.line(xNote, y, xNote, y + hId);
  doc.line(CADRE_X + (xNote - CADRE_X) / 2, y, CADRE_X + (xNote - CADRE_X) / 2, y + hId);
  doc.line(CADRE_X, y + hId / 2, xNote, y + hId / 2);

  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...ARDOISE);
  const demi = (xNote - CADRE_X) / 2;
  const champs: [string, number, number][] = [
    ["Nom", CADRE_X + 4, y + 6.5],
    ["Prénom", CADRE_X + demi + 4, y + 6.5],
    ["Groupe", CADRE_X + 4, y + 16.5],
    ["Date", CADRE_X + demi + 4, y + 16.5],
  ];
  for (const [libelle, cx, cy] of champs) doc.text(`${libelle} :`, cx, cy);
  if (c.groupeNom) {
    doc.setTextColor(...ENCRE).setFont("helvetica", "bold");
    doc.text(c.groupeNom, CADRE_X + 20, y + 16.5);
    doc.setFont("helvetica", "normal").setTextColor(...ARDOISE);
  }

  // Case note, réservée au correcteur
  doc.setFontSize(7).setTextColor(...ARDOISE);
  doc.text("Note", xNote + 15, y + 6, { align: "center" });
  doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(...ENCRE);
  doc.text(`/ ${totalBareme}`, xNote + 15, y + 15, { align: "center" });
  y += hId;

  // -------------------------------------------------------------- consignes
  if (c.consignes?.trim()) {
    doc.setFont("helvetica", "normal").setFontSize(8.2);
    const lignes = doc.splitTextToSize(c.consignes.trim(), LARGEUR - 6);
    const h = lignes.length * 4.2 + 9;
    doc.setDrawColor(...TRAIT).setLineWidth(0.4);
    doc.line(CADRE_X, y + h, CADRE_X + CADRE_L, y + h);
    doc.setFillColor(...FORET);
    doc.rect(CADRE_X, y, 1.5, h, "F");
    doc.setFont("helvetica", "bold").setFontSize(7.6).setTextColor(...ENCRE);
    doc.text("CONSIGNES", X, y + 5.5);
    doc.setFont("helvetica", "normal").setFontSize(8.2);
    lignes.forEach((l: string, i: number) => doc.text(l, X, y + 10.5 + i * 4.2));
    y += h;
  }

  y += 8;

  // -------------------------------------------------------------- questions
  c.questions.forEach((q, index) => {
    const bareme = Number(q.bareme) || 0;
    const estQcm = q.type === "qcm" && (q.options?.length ?? 0) > 0;
    const options = estQcm ? q.options! : [];
    const { nature, corps } = decoupeEnonce(nettoieEnonce(q.enonce || ""));
    const num = `${romain(index + 1)}.`;
    const retrait = 9;

    doc.setFont("helvetica", "normal").setFontSize(9);
    const lignes = doc.splitTextToSize(corps, LARGEUR - retrait);

    // Un QCM se compose en cases à cocher : il n'a pas besoin de lignes
    // d'écriture, et sa hauteur découle du nombre de propositions.
    const lignesOptions = estQcm
      ? options.map((o) => doc.splitTextToSize(o.texte, LARGEUR - retrait - 8))
      : [];
    const hReponse = estQcm
      ? lignesOptions.reduce((s, l) => s + Math.max(6, l.length * 4.2 + 2), 0) + 2
      : Math.max(20, Math.min(92, 14 + bareme * 7));
    const hQuestion = 6.5 + lignes.length * 4.5 + 3 + hReponse + 9;
    const hPageVide = BAS_CONTENU - (CADRE_Y + 29);

    // Une question tient d'un seul tenant chaque fois qu'elle le peut.
    assurerPlace(hQuestion <= hPageVide ? hQuestion : 6.5 + 2 * 4.5 + 8);

    // Ligne de titre : « I. QCM ................ 4 pts »
    doc.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(...ENCRE);
    doc.text(num, X, y);
    const libelle =
      nature ??
      (q.type === "qcm"
        ? "Choix multiple"
        : q.type === "exercice"
          ? "Exercice d'application"
          : "Question");
    doc.text(libelle, X + retrait, y);
    const pts = `${bareme} pts`;
    doc.setFont("helvetica", "normal").setFontSize(9);
    const xFin = CADRE_X + CADRE_L - PAD;
    const largeurPts = doc.getTextWidth(pts);
    doc.setFont("helvetica", "bold").setFontSize(9.5);
    const debutPoints = X + retrait + doc.getTextWidth(libelle) + 2;
    const finPoints = xFin - largeurPts - 2;
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...CLAIR);
    if (finPoints > debutPoints) {
      const unPoint = doc.getTextWidth(".");
      const n = Math.floor((finPoints - debutPoints) / unPoint);
      doc.text(".".repeat(Math.max(0, n)), debutPoints, y);
    }
    doc.setTextColor(...ENCRE);
    doc.text(pts, xFin, y, { align: "right" });
    y += 6.5;

    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...ENCRE);
    for (const ligne of lignes) {
      assurerPlace(5);
      doc.text(ligne, X + retrait, y);
      y += 4.5;
    }
    y += 3;

    assurerPlace(hReponse);

    if (estQcm) {
      // Propositions à cocher. La bonne réponse n'est évidemment pas révélée :
      // ce document est le sujet remis au stagiaire.
      doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...ENCRE);
      options.forEach((_, j) => {
        const lignesOpt = lignesOptions[j];
        const xCase = X + retrait;
        doc.setDrawColor(...TRAIT).setLineWidth(0.35);
        doc.rect(xCase, y - 0.5, 3.4, 3.4);
        lignesOpt.forEach((ligne: string, k: number) => {
          doc.text(ligne, xCase + 6, y + 2.4 + k * 4.2);
        });
        y += Math.max(6, lignesOpt.length * 4.2 + 2);
      });
      y += 2 + 9;
    } else {
      // Lignes pointillées, jamais scindées entre deux pages.
      doc.setDrawColor(...CLAIR).setLineWidth(0.25);
      doc.setLineDashPattern([0.6, 1.4], 0);
      for (let l = 7; l <= hReponse; l += 7) {
        doc.line(X + retrait, y + l, xFin, y + l);
      }
      doc.setLineDashPattern([], 0);
      y += hReponse + 9;
    }
  });

  // ---------------------------------------------------------- pieds de page
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p += 1) {
    doc.setPage(p);
    const yPied = CADRE_Y + CADRE_H - 7;
    doc.setDrawColor(...TRAIT).setLineWidth(0.4);
    doc.line(CADRE_X, yPied - 4, CADRE_X + CADRE_L, yPied - 4);
    doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(...ARDOISE);
    doc.text(
      doc.splitTextToSize(`${c.moduleCode ?? ""} ${c.moduleNom}`.trim(), CADRE_L - 40)[0],
      X,
      yPied,
    );
    doc.text(`Page ${p} / ${total}`, CADRE_X + CADRE_L - PAD, yPied, {
      align: "right",
    });
  }

  return doc;
}

export function telechargerControlePdf(c: ControlePdf, nomFichier: string) {
  construireControlePdf(c).save(nomFichier);
}
