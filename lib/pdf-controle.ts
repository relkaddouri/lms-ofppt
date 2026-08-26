import jsPDF from "jspdf";

/**
 * Génération vectorielle du sujet de contrôle.
 *
 * L'ancien export rasterisait le HTML avec html2canvas : le corps devenait une
 * seule image très haute, découpée à l'aveugle entre les pages — une question
 * pouvait être coupée en deux, et sur les pages suivantes le fond blanc de
 * l'image recouvrait l'en-tête. Ici le texte est écrit directement dans le PDF :
 * la pagination se décide question par question, le texte reste sélectionnable
 * et le fichier pèse quelques dizaines de kilo-octets au lieu de plusieurs cents.
 *
 * Police : Helvetica, l'une des polices standard du format PDF. Embarquer
 * General Sans alourdirait le bundle client de plusieurs centaines de kilos pour
 * un document destiné à l'impression ; le design system régit l'écran.
 */

export type QuestionPdf = { enonce: string; bareme: number };

export type ControlePdf = {
  titre: string;
  moduleNom: string;
  moduleCode?: string | null;
  groupeNom?: string | null;
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
const MARGE = 18;
const LARGEUR = PAGE_L - MARGE * 2;
const HAUT_CONTENU = 42;
const BAS_CONTENU = PAGE_H - 20;

const ENCRE: [number, number, number] = [22, 36, 31];
const ARDOISE: [number, number, number] = [107, 114, 128];
const BORDURE: [number, number, number] = [229, 231, 235];
const FORET: [number, number, number] = [14, 59, 46];
const PAPIER: [number, number, number] = [246, 247, 249];

const LIBELLE_TYPE = {
  CC: "Contrôle continu",
  EFM: "Épreuve de fin de module",
} as const;

const LIBELLE_FORMAT = {
  theorique: "Théorique",
  pratique: "Pratique",
  mixte: "Théorique et pratique",
} as const;

/**
 * Les énoncés produits par l'IA commencent souvent par « 3. Question courte
 * (3 points) : ». Le numéro et le barème sont déjà affichés par la mise en page :
 * les répéter dans l'énoncé fait doublon.
 */
export function nettoieEnonce(enonce: string): string {
  return enonce
    .replace(/^\s*\d+\s*[.)]\s*/, "")
    .replace(/^\(?\s*(QCM|Question courte|Exercice d['’]application)\s*\)?\s*/i, "$1 — ")
    .replace(/\(\s*\d+\s*points?\s*\)\s*:?\s*/i, "")
    .replace(/^\s*[—-]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function heureFr(n: number) {
  return `${n.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} h`;
}

export function construireControlePdf(c: ControlePdf): jsPDF {
  const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4", compress: true });
  doc.setFont("helvetica", "normal");

  const totalBareme = c.questions.reduce((s, q) => s + (Number(q.bareme) || 0), 0);
  let y = HAUT_CONTENU;

  // ---------------------------------------------------------------- en-tête
  const enTete = () => {
    doc.setTextColor(...ENCRE);
    doc.setFont("helvetica", "bold").setFontSize(15);
    doc.text("OFPPT", MARGE, 21);

    doc.setFont("helvetica", "normal").setFontSize(7.5);
    doc.text(
      "Office de la Formation Professionnelle et de la Promotion du Travail",
      MARGE,
      26,
    );
    doc.setTextColor(...ARDOISE);
    doc.text("Royaume du Maroc", MARGE, 30);

    const droite = PAGE_L - MARGE;
    doc.setTextColor(...ENCRE);
    doc.setFont("helvetica", "bold").setFontSize(8.5);
    doc.text(LIBELLE_TYPE[c.type], droite, 21, { align: "right" });
    doc.setFont("helvetica", "normal").setFontSize(8);
    doc.setTextColor(...ARDOISE);
    if (c.moduleCode) doc.text(c.moduleCode, droite, 26, { align: "right" });
    if (c.groupeNom) doc.text(`Groupe ${c.groupeNom}`, droite, 30, { align: "right" });

    doc.setDrawColor(...ENCRE).setLineWidth(0.5);
    doc.line(MARGE, 34, PAGE_L - MARGE, 34);
  };

  const pageSuivante = () => {
    doc.addPage();
    enTete();
    y = HAUT_CONTENU;
  };

  /** Ajoute une page si `besoin` millimètres ne tiennent pas sur la page courante. */
  const assurerPlace = (besoin: number) => {
    if (y + besoin > BAS_CONTENU) pageSuivante();
  };

  enTete();

  // ------------------------------------------------------------------ titre
  doc.setTextColor(...ENCRE).setFont("helvetica", "bold").setFontSize(14);
  const titre = doc.splitTextToSize(c.titre.toUpperCase(), LARGEUR);
  for (const ligne of titre) {
    doc.text(ligne, PAGE_L / 2, y, { align: "center" });
    y += 6.5;
  }

  // Les titres générés reprennent souvent le nom du module : ne pas le répéter.
  const normalise = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const titreContientModule = normalise(c.titre).includes(normalise(c.moduleNom));
  const sousTitre = titreContientModule
    ? c.moduleCode ?? ""
    : c.moduleCode
      ? `${c.moduleCode} — ${c.moduleNom}`
      : c.moduleNom;

  if (sousTitre) {
    doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(...ARDOISE);
    for (const ligne of doc.splitTextToSize(sousTitre, LARGEUR)) {
      doc.text(ligne, PAGE_L / 2, y, { align: "center" });
      y += 5;
    }
  }
  y += 3;

  // ----------------------------------------------------------- bandeau méta
  const meta = [
    `Durée : ${heureFr(c.dureeHeures)}`,
    `Barème : ${totalBareme} points`,
    LIBELLE_FORMAT[c.format],
  ];
  if (c.type === "EFM" && c.typeEfm) {
    meta.push(c.typeEfm === "regional" ? "EFM régional" : "EFM local");
  }
  doc.setFillColor(...PAPIER).setDrawColor(...BORDURE).setLineWidth(0.2);
  doc.roundedRect(MARGE, y, LARGEUR, 9, 1.5, 1.5, "FD");
  doc.setFontSize(8.5).setTextColor(...ENCRE);
  const pas = LARGEUR / meta.length;
  meta.forEach((m, i) => {
    doc.text(m, MARGE + pas * i + pas / 2, y + 5.8, { align: "center" });
  });
  y += 15;

  // ------------------------------------------------------------- identité
  doc.setFontSize(8.5).setTextColor(...ARDOISE);
  const champs = ["Nom", "Prénom", "Groupe", "Date"];
  const largeurChamp = LARGEUR / 2 - 4;
  champs.forEach((champ, i) => {
    const col = i % 2;
    const rang = Math.floor(i / 2);
    const x = MARGE + col * (largeurChamp + 8);
    const yc = y + rang * 11;
    doc.text(`${champ} :`, x, yc);
    doc.setDrawColor(...BORDURE).setLineWidth(0.3);
    doc.line(x + 16, yc + 1, x + largeurChamp, yc + 1);
  });
  y += 22;

  // ------------------------------------------------------------- consignes
  if (c.consignes?.trim()) {
    doc.setFontSize(8.5);
    const lignes = doc.splitTextToSize(c.consignes.trim(), LARGEUR - 12);
    const hauteur = lignes.length * 4.4 + 9;
    assurerPlace(hauteur + 4);
    doc.setFillColor(...PAPIER).setDrawColor(...BORDURE).setLineWidth(0.2);
    doc.roundedRect(MARGE, y, LARGEUR, hauteur, 1.5, 1.5, "FD");
    doc.setFillColor(...FORET);
    doc.rect(MARGE, y, 1.2, hauteur, "F");
    doc.setTextColor(...ENCRE).setFont("helvetica", "bold");
    doc.text("Consignes", MARGE + 6, y + 6);
    doc.setFont("helvetica", "normal").setTextColor(...ENCRE);
    lignes.forEach((l: string, i: number) => {
      doc.text(l, MARGE + 6, y + 11 + i * 4.4);
    });
    y += hauteur + 9;
  }

  // ------------------------------------------------------------- questions
  c.questions.forEach((q, index) => {
    const bareme = Number(q.bareme) || 0;
    const enonce = nettoieEnonce(q.enonce || "");
    doc.setFont("helvetica", "normal").setFontSize(9.5);
    const lignes = doc.splitTextToSize(enonce, LARGEUR);

    const hauteurReponse = Math.max(22, Math.min(95, 16 + bareme * 7));
    const hauteurQuestion =
      7.5 + lignes.length * 4.8 + 2.5 + hauteurReponse + 8;
    const hauteurPageVide = BAS_CONTENU - HAUT_CONTENU;

    // Une question tient d'un seul tenant chaque fois que c'est possible : mieux
    // vaut du blanc en bas de page qu'un énoncé séparé de sa zone de réponse.
    // Si elle est trop haute pour une page entière, on se rabat sur la règle
    // minimale : ne jamais séparer l'intitulé de ses deux premières lignes.
    assurerPlace(
      hauteurQuestion <= hauteurPageVide
        ? hauteurQuestion
        : 8 + Math.min(lignes.length, 2) * 4.8 + 10,
    );

    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...ENCRE);
    doc.text(`Question ${index + 1}`, MARGE, y);
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...ARDOISE);
    doc.text(`${bareme} pts`, PAGE_L - MARGE, y, { align: "right" });
    doc.setDrawColor(...BORDURE).setLineWidth(0.3);
    doc.line(MARGE, y + 1.8, PAGE_L - MARGE, y + 1.8);
    y += 7.5;

    doc.setFontSize(9.5).setTextColor(...ENCRE);
    for (const ligne of lignes) {
      assurerPlace(5);
      doc.text(ligne, MARGE, y);
      y += 4.8;
    }
    y += 2.5;

    // Espace de réponse proportionnel au barème, borné pour rester lisible.
    // Jamais scindé : un fragment de lignes orphelin en haut de page suivante
    // n'aide personne à composer.
    assurerPlace(hauteurReponse);
    doc.setDrawColor(...BORDURE).setLineWidth(0.25);
    for (let ligne = 8; ligne <= hauteurReponse; ligne += 8) {
      doc.line(MARGE, y + ligne, PAGE_L - MARGE, y + ligne);
    }
    y += hauteurReponse + 8;
  });

  // ---------------------------------------------------------- pieds de page
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p += 1) {
    doc.setPage(p);
    doc.setDrawColor(...BORDURE).setLineWidth(0.2);
    doc.line(MARGE, PAGE_H - 15, PAGE_L - MARGE, PAGE_H - 15);
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...ARDOISE);
    const gauche = doc.splitTextToSize(`LMS OFPPT — ${c.titre}`, LARGEUR - 30)[0];
    doc.text(gauche, MARGE, PAGE_H - 10.5);
    doc.text(`Page ${p} / ${total}`, PAGE_L - MARGE, PAGE_H - 10.5, {
      align: "right",
    });
  }

  return doc;
}

export function telechargerControlePdf(c: ControlePdf, nomFichier: string) {
  construireControlePdf(c).save(nomFichier);
}
