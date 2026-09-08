import { jsPDF } from "jspdf";
import { dessinerLogo, type Marque } from "@/lib/pdf-marque";
import { COULEURS, installerPolices, police } from "@/lib/pdf-theme";
import { LARGEUR, X } from "@/lib/pdf-cartouche";
import { insecable } from "@/lib/typographie";
import type { Identification } from "@/lib/resultat";

/**
 * La page de garde d'un dossier d'épreuve (PRD §4.7).
 *
 * Elle ne s'ouvre pas, elle se colle : le formateur l'imprime en tête du lot
 * et la pose sur la chemise cartonnée qui part à l'administration. Elle se lit
 * donc à un mètre, debout devant une armoire, et non à la table de travail.
 *
 * D'où une composition qui ne ressemble pas au cartouche des pièces qu'elle
 * annonce. Là, tout est également important et se parcourt du regard ; ici,
 * trois choses comptent — quelle épreuve, quel groupe, combien de copies — et
 * le reste vient après. Le même tableau à filets aurait donné une page juste
 * mais illisible de loin.
 */

export type PageDeGarde = {
  /** L'intitulé du contrôle, en gros sur le panneau. */
  titre: string;
  /** « Contrôle continu » ou « Épreuve de fin de module ». */
  nature: string;
  identification: Identification;
  /** Effectif du groupe, tel qu'il émarge. */
  effectif: number;
  /** Copies dont le résultat est publié, celles que le dossier contient. */
  copies: number;
  /** Moyenne des copies publiées, `null` s'il n'y en a aucune. */
  moyenne: number | null;
  /** Le total du barème — 20 pour un CC, 40 pour un EFM. */
  total: number;
  /** Vrai si la feuille d'émargement est jointe derrière. */
  avecEmargement: boolean;
  /** La date d'édition du dossier. */
  dateEdition: string;
};

/** Une paire étiquette/valeur de la grille d'identification. */
function champ(
  doc: jsPDF,
  etiquette: string,
  valeur: string | null | undefined,
  x: number,
  y: number,
  largeur: number,
): number {
  if (!valeur?.trim()) return y;
  police(doc, "mono", 7);
  doc.setTextColor(...COULEURS.ardoiseClaire);
  doc.text(etiquette, x, y);

  police(doc, "corps", 10.5);
  doc.setTextColor(...COULEURS.encre);
  const lignes: string[] = doc.splitTextToSize(insecable(valeur.trim()), largeur);
  lignes.forEach((l, i) => doc.text(l, x, y + 5.6 + i * 5));
  return y + 5.6 + lignes.length * 5 + 5;
}

/** Un chiffre et son intitulé, dans un cadre. */
function tuile(
  doc: jsPDF,
  valeur: string,
  intitule: string,
  x: number,
  y: number,
  largeur: number,
  accent: readonly [number, number, number],
): void {
  const HAUTEUR = 24;
  doc.setFillColor(...COULEURS.papier);
  doc.setDrawColor(...COULEURS.bordure);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, largeur, HAUTEUR, 2, 2, "FD");

  // Un filet de couleur sur la tranche gauche : il distingue les trois tuiles
  // sans les colorer entièrement, ce que la charte réserve aux alertes.
  doc.setFillColor(...accent);
  doc.rect(x, y + 3, 1.2, HAUTEUR - 6, "F");

  police(doc, "titre", 17);
  doc.setTextColor(...COULEURS.encre);
  doc.text(valeur, x + 6, y + 12);

  police(doc, "mono", 6.8);
  doc.setTextColor(...COULEURS.ardoiseClaire);
  doc.text(intitule.toLocaleUpperCase("fr"), x + 6, y + 18.5);
}

export function dessinerPageDeGarde(
  doc: jsPDF,
  g: PageDeGarde,
  marque?: Marque,
): void {
  const id = g.identification;

  // ── Le bandeau du centre ─────────────────────────────────────────────────
  const largeurLogo = dessinerLogo(doc, marque, X, 14, 13, LARGEUR * 0.42);
  if (id.etablissement?.trim()) {
    police(doc, "corps", 8.5);
    doc.setTextColor(...COULEURS.ardoise);
    const lignes: string[] = doc.splitTextToSize(
      id.etablissement.trim(),
      LARGEUR - largeurLogo - 8,
    );
    lignes.forEach((l, i) =>
      doc.text(l, X + LARGEUR, 19 + i * 4.4, { align: "right" }),
    );
  }

  // ── Le panneau d'annonce ─────────────────────────────────────────────────
  //
  // Le seul aplat d'encre de la page, et ce qui la fait reconnaître de loin
  // dans une pile de chemises.
  const HAUT_PANNEAU = 40;
  police(doc, "titre", 27);
  const titre: string[] = doc.splitTextToSize(insecable(g.titre), LARGEUR - 32);
  const hauteurPanneau = Math.max(76, 52 + titre.length * 12);

  doc.setFillColor(...COULEURS.encre);
  doc.roundedRect(X, HAUT_PANNEAU, LARGEUR, hauteurPanneau, 4, 4, "F");

  // La marque du produit : vert, sarcelle, corail, toujours dans cet ordre.
  [COULEURS.vert, COULEURS.sarcelle, COULEURS.corail].forEach((c, i) => {
    doc.setFillColor(...c);
    doc.circle(X + 18 + i * 6.5, HAUT_PANNEAU + 16, 2.1, "F");
  });

  police(doc, "mono", 8.5);
  doc.setTextColor(...COULEURS.ardoiseClaire);
  doc.text("DOSSIER D'ÉPREUVE", X + 16, HAUT_PANNEAU + 29);

  police(doc, "titre", 27);
  doc.setTextColor(...COULEURS.blanc);
  titre.forEach((l, i) =>
    doc.text(l, X + 16, HAUT_PANNEAU + 44 + i * 12),
  );

  police(doc, "corps", 11);
  doc.setTextColor(...COULEURS.bordureForte);
  doc.text(
    [g.nature, id.module].filter(Boolean).join(" · "),
    X + 16,
    HAUT_PANNEAU + 44 + titre.length * 12 + 4,
    { maxWidth: LARGEUR - 32 },
  );

  // ── Les trois chiffres ───────────────────────────────────────────────────
  let y = HAUT_PANNEAU + hauteurPanneau + 12;
  const gouttiere = 6;
  const largeurTuile = (LARGEUR - gouttiere * 2) / 3;
  tuile(doc, String(g.effectif), "Stagiaires du groupe", X, y, largeurTuile, COULEURS.sarcelle);
  tuile(
    doc,
    String(g.copies),
    "Copies au dossier",
    X + largeurTuile + gouttiere,
    y,
    largeurTuile,
    COULEURS.vert,
  );
  tuile(
    doc,
    g.moyenne === null ? "—" : `${g.moyenne.toFixed(2)} / ${g.total}`,
    "Moyenne du groupe",
    X + (largeurTuile + gouttiere) * 2,
    y,
    largeurTuile,
    COULEURS.encre,
  );
  y += 34;

  // ── L'identification, aérée ──────────────────────────────────────────────
  const colonne = (LARGEUR - 10) / 2;
  const gauche = [
    ["FILIÈRE", id.filiere],
    ["GROUPE", id.groupe],
    ["ANNÉE SCOLAIRE", id.anneeScolaire],
  ] as const;
  const droite = [
    ["DATE DE L'ÉPREUVE", id.dateEpreuve],
    ["HORAIRE", id.horaire],
    [
      "FORMATEUR",
      [id.formateur, id.matricule ? `mat. ${id.matricule}` : null]
        .filter(Boolean)
        .join(" · ") || null,
    ],
  ] as const;

  let yGauche = y;
  let yDroite = y;
  for (const [e, v] of gauche) yGauche = champ(doc, e, v, X, yGauche, colonne);
  for (const [e, v] of droite)
    yDroite = champ(doc, e, v, X + colonne + 10, yDroite, colonne);
  y = Math.max(yGauche, yDroite) + 4;

  // ── Ce que la chemise contient ───────────────────────────────────────────
  //
  // Écrit noir sur blanc pour qu'on vérifie l'épaisseur du paquet sans
  // l'ouvrir — c'est à quoi sert une page de garde.
  doc.setDrawColor(...COULEURS.bordure).setLineWidth(0.3);
  const hautContenu = y;
  const pieces = [
    g.avecEmargement ? "Feuille d'émargement signée par les stagiaires" : null,
    `${g.copies} résultat${g.copies > 1 ? "s" : ""} d'évaluation, à faire signer`,
  ].filter(Boolean) as string[];
  const hauteurContenu = 14 + pieces.length * 6;
  doc.setFillColor(...COULEURS.blanc);
  doc.roundedRect(X, hautContenu, LARGEUR, hauteurContenu, 2, 2, "FD");

  police(doc, "mono", 7);
  doc.setTextColor(...COULEURS.ardoiseClaire);
  doc.text("CONTENU DU DOSSIER", X + 6, hautContenu + 7.5);

  police(doc, "corps", 9.5);
  doc.setTextColor(...COULEURS.corps);
  pieces.forEach((piece, i) => {
    doc.setFillColor(...COULEURS.sarcelle);
    doc.circle(X + 7.5, hautContenu + 13.4 + i * 6, 0.8, "F");
    doc.text(piece, X + 11, hautContenu + 14.4 + i * 6);
  });
  y = hautContenu + hauteurContenu + 14;

  // ── La signature ─────────────────────────────────────────────────────────
  //
  // Seule, celle du formateur : c'est lui qui remet le dossier. Rien n'est
  // prévu pour un visa de la Direction, qui n'a pas été demandé — un cadre
  // vide sur un document officiel finit toujours par être rempli de travers.
  // Le trait descend de 34 mm sous l'intitulé : c'est la place qu'il faut
  // pour signer. Calé sur le bas de page, il se retrouvait à douze
  // millimètres du nom et la signature n'avait nulle part où aller.
  const hautSignature = Math.max(y, 224);
  const basSignature = hautSignature + 34;

  police(doc, "mono", 7);
  doc.setTextColor(...COULEURS.ardoiseClaire);
  doc.text("LE FORMATEUR", X + LARGEUR - 72, hautSignature);

  police(doc, "corps", 9.5);
  doc.setTextColor(...COULEURS.corps);
  const signataire = [id.formateur, id.matricule ? `mat. ${id.matricule}` : null]
    .filter(Boolean)
    .join(" · ");
  if (signataire) {
    doc.text(signataire, X + LARGEUR - 72, hautSignature + 5.5);
  }

  doc.setDrawColor(...COULEURS.bordureForte).setLineWidth(0.3);
  doc.line(X + LARGEUR - 72, basSignature, X + LARGEUR, basSignature);
  police(doc, "corps", 7.5);
  doc.setTextColor(...COULEURS.ardoiseClaire);
  doc.text("Date et signature", X + LARGEUR - 72, basSignature + 4.5);

  // ── Pied de page ─────────────────────────────────────────────────────────
  police(doc, "corps", 7.5);
  doc.setTextColor(...COULEURS.muet);
  doc.text(`Dossier édité le ${g.dateEdition}`, X, 289);
}

export async function telechargerPageDeGardePdf(
  g: PageDeGarde,
  nomFichier: string,
  marque?: Marque,
): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  await installerPolices(doc);
  dessinerPageDeGarde(doc, g, marque);
  doc.save(nomFichier);
}
