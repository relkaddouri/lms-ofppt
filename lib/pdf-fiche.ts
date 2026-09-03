import type jsPDF from "jspdf";
import { dessinerEntete, type Marque } from "@/lib/pdf-marque";

/**
 * Fiche de préparation au format officiel OFPPT.
 *
 * La mise en page reprend le formulaire papier utilisé par les formateurs :
 * bandeau d'identification, puis trois tableaux — Introduction, Développement,
 * Conclusion — chacun portant sa colonne de durée. On ne réinvente rien : une
 * fiche qui ne ressemble pas au formulaire attendu est refusée en commission.
 */

export type BlocFichePdf = { contenu: string; minutes: number };
export type LigneDeveloppementPdf = {
  strategie: string;
  contenu: string;
  minutes: number;
};

export type FichePdf = {
  /** « cours théorique » ou « cours pratique ». */
  nature: string;
  date: string | null;
  dureeHeures: number | null;
  filiere: string;
  annee: number | null;
  groupe: string;
  module: string;
  objectifs: string;
  modalite: string;
  fichiers: string;
  motivation: BlocFichePdf;
  plan: BlocFichePdf;
  developpement: LigneDeveloppementPdf[];
  evaluation: BlocFichePdf;
  prochaine: BlocFichePdf;
};

export const X = 14;
export const LARGEUR = 182;
export const HAUT = 16;
export const BAS = 282;

export const ENCRE: [number, number, number] = [17, 24, 39];
export const TRAIT: [number, number, number] = [80, 80, 80];
const FOND: [number, number, number] = [238, 240, 243];

function minutes(n: number): string {
  return n > 0 ? `${n} minutes` : "";
}

export async function construireFichePdf(
  f: FichePdf,
  marque?: Marque,
): Promise<jsPDF> {
  const { default: JsPDF } = await import("jspdf");
  const doc = new JsPDF({ unit: "mm", format: "a4" });
  dessinerFiche(doc, f, marque);
  return doc;
}

/**
 * Dessine une fiche sur la page courante, à partir du haut, et ajoute autant
 * de pages que nécessaire.
 *
 * Séparé de `construireFichePdf` pour que le classeur pédagogique puisse
 * enchaîner les fiches dans un seul document au lieu d'en produire un par
 * séance : la mise en page officielle n'existe qu'ici, elle n'est pas
 * réécrite ailleurs (conventions.md).
 */
export function dessinerFiche(doc: jsPDF, f: FichePdf, marque?: Marque): void {
  // L'identité du centre passe avant le titre : c'est l'ordre du formulaire
  // officiel, où l'établissement se lit en premier.
  let y = dessinerEntete(doc, marque, X, HAUT, LARGEUR);

  function saut(hauteur: number) {
    if (y + hauteur > BAS) {
      doc.addPage();
      y = HAUT;
    }
  }

  /** Hauteur qu'occuperont des lignes de texte dans une largeur donnée. */
  function hauteurTexte(texte: string, largeur: number, taille = 9): number {
    doc.setFontSize(taille);
    const lignes = doc.splitTextToSize(texte || " ", largeur - 4);
    return lignes.length * (taille * 0.42) + 3;
  }

  /** Une ligne de tableau : cellules de largeurs données, bordées. */
  function ligne(
    cellules: { texte: string; largeur: number; gras?: boolean; fond?: boolean }[],
    tailleTexte = 9,
  ) {
    const hauteur = Math.max(
      7,
      ...cellules.map((c) => hauteurTexte(c.texte, c.largeur, tailleTexte)),
    );
    saut(hauteur);

    let x = X;
    for (const c of cellules) {
      if (c.fond) {
        doc.setFillColor(...FOND);
        doc.rect(x, y, c.largeur, hauteur, "F");
      }
      doc.setDrawColor(...TRAIT).setLineWidth(0.2);
      doc.rect(x, y, c.largeur, hauteur);

      doc
        .setFont("helvetica", c.gras ? "bold" : "normal")
        .setFontSize(tailleTexte)
        .setTextColor(...ENCRE);
      const lignes = doc.splitTextToSize(c.texte || "", c.largeur - 4);
      lignes.forEach((l: string, i: number) => {
        doc.text(l, x + 2, y + 4 + i * (tailleTexte * 0.42));
      });
      x += c.largeur;
    }
    y += hauteur;
  }

  function titreTableau(libelle: string, colonneDuree = true) {
    const l1 = colonneDuree ? LARGEUR - 30 : LARGEUR;
    ligne(
      colonneDuree
        ? [
            { texte: libelle, largeur: l1, gras: true, fond: true },
            { texte: "Durée", largeur: 30, gras: true, fond: true },
          ]
        : [{ texte: libelle, largeur: l1, gras: true, fond: true }],
    );
  }

  // ── Titre ────────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(...ENCRE);
  doc.text(`Fiche préparation : ${f.nature}`, X, y);
  y += 7;

  // ── Bandeau d'identification ─────────────────────────────────────────────
  const moitie = LARGEUR / 2;
  ligne([
    { texte: `Date de la séance : ${f.date ?? "—"}`, largeur: moitie },
    {
      texte: `Durée de la séance : ${f.dureeHeures ? `${f.dureeHeures} heures` : "—"}`,
      largeur: moitie,
    },
  ]);

  // Ligne des années : cases à cocher, celle du groupe marquée d'un X.
  const lAnnee = 20;
  const lCase = 8;
  const lFiliere = 52;
  const lGroupe = LARGEUR - lFiliere - 3 * (lAnnee + lCase);
  ligne([
    { texte: `Filière : ${f.filiere}`, largeur: lFiliere },
    { texte: "1ère année", largeur: lAnnee },
    { texte: f.annee === 1 ? "X" : "", largeur: lCase },
    { texte: "2ème année", largeur: lAnnee },
    { texte: f.annee === 2 ? "X" : "", largeur: lCase },
    { texte: "3ème année", largeur: lAnnee },
    { texte: f.annee === 3 ? "X" : "", largeur: lCase },
    { texte: `Groupe : ${f.groupe}`, largeur: lGroupe },
  ], 8);

  ligne([{ texte: `Module : ${f.module}`, largeur: LARGEUR }]);
  ligne([{ texte: `Objectifs de la séance : ${f.objectifs}`, largeur: LARGEUR }]);
  ligne([{ texte: `Modalité : ${f.modalite}`, largeur: LARGEUR }]);
  ligne([{ texte: `Fichiers de travail : ${f.fichiers}`, largeur: LARGEUR }]);

  y += 4;

  // ── Introduction ─────────────────────────────────────────────────────────
  const lLibelle = 42;
  const lDuree = 30;
  const lContenu = LARGEUR - lLibelle - lDuree;

  titreTableau("Introduction");
  ligne([
    { texte: "Éléments de motivation\nPar interaction active", largeur: lLibelle },
    { texte: f.motivation.contenu, largeur: lContenu },
    { texte: minutes(f.motivation.minutes), largeur: lDuree },
  ]);
  ligne([
    { texte: "Plan de la séance", largeur: lLibelle },
    { texte: f.plan.contenu, largeur: lContenu },
    { texte: minutes(f.plan.minutes), largeur: lDuree },
  ]);

  y += 4;

  // ── Développement ────────────────────────────────────────────────────────
  ligne([
    { texte: "Stratégies pédagogiques", largeur: lLibelle, gras: true, fond: true },
    { texte: "Développement", largeur: lContenu, gras: true, fond: true },
    { texte: "Durée", largeur: lDuree, gras: true, fond: true },
  ]);
  for (const l of f.developpement) {
    ligne([
      { texte: l.strategie, largeur: lLibelle },
      { texte: l.contenu, largeur: lContenu },
      { texte: minutes(l.minutes), largeur: lDuree },
    ]);
  }

  y += 4;

  // ── Conclusion ───────────────────────────────────────────────────────────
  titreTableau("Conclusion");
  ligne([
    { texte: "Évaluation formative", largeur: lLibelle },
    { texte: f.evaluation.contenu, largeur: lContenu },
    { texte: minutes(f.evaluation.minutes), largeur: lDuree },
  ]);
  ligne([
    { texte: "Prochaine séance\n(pédagogie inversée)", largeur: lLibelle },
    { texte: f.prochaine.contenu, largeur: lContenu },
    { texte: minutes(f.prochaine.minutes), largeur: lDuree },
  ]);
}

export async function telechargerFichePdf(
  f: FichePdf,
  nomFichier: string,
  marque?: Marque,
) {
  const doc = await construireFichePdf(f, marque);
  doc.save(nomFichier);
}
