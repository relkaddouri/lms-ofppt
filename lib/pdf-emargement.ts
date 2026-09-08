import { jsPDF } from "jspdf";
import type { Marque } from "@/lib/pdf-marque";
import { COULEURS, installerPolices, police } from "@/lib/pdf-theme";
import { dessinerCartouche, LARGEUR, X } from "@/lib/pdf-cartouche";
import type { Identification } from "@/lib/resultat";

/**
 * La feuille d'émargement d'une épreuve (PRD §4.7).
 *
 * Ce que l'administration réclame après un contrôle : la preuve que tel
 * stagiaire était présent, de sa main. Elle porte le même cartouche que le
 * résultat — même centre, même groupe, même épreuve, même horaire — parce que
 * les deux pièces voyagent ensemble et doivent s'annoncer pareil.
 *
 * Une seule page, tenue coûte que coûte : c'est une feuille qu'on fait
 * circuler dans la salle, pas un dossier. La hauteur des lignes s'ajuste donc
 * à l'effectif plutôt que de déborder — quitte à devenir serrée pour un très
 * grand groupe, ce qui reste préférable à une signature partie sur une
 * deuxième feuille qu'on oublie de faire signer.
 */

export type PresentEmargement = {
  cef: string | null;
  nom: string;
};

export type FeuilleEmargement = {
  titre: string;
  nature: string;
  identification: Identification;
  stagiaires: PresentEmargement[];
};

/** Ce qui reste entre le bas du tableau et le cadre de signature. */
const BAS_TABLEAU = 232;

export function dessinerEmargement(
  doc: jsPDF,
  f: FeuilleEmargement,
  marque?: Marque,
): void {
  let y = dessinerCartouche(
    doc,
    {
      titre: "Feuille d'émargement",
      nature: f.nature,
      epreuve: f.titre,
      mention: `${f.stagiaires.length} stagiaire${f.stagiaires.length > 1 ? "s" : ""}`,
      identification: f.identification,
    },
    marque,
  );

  // ── Le tableau ───────────────────────────────────────────────────────────
  //
  // Quatre colonnes, dont deux vides : l'émargement et l'observation se
  // remplissent à la main. Leur largeur est ce qui compte — une case trop
  // étroite ne se signe pas.
  const COLONNES: { titre: string; part: number }[] = [
    { titre: "N°", part: 0.06 },
    { titre: "CEF", part: 0.16 },
    { titre: "Nom et prénom", part: 0.34 },
    { titre: "Émargement", part: 0.26 },
    { titre: "Observation", part: 0.18 },
  ];
  const largeurs = COLONNES.map((c) => c.part * LARGEUR);
  const bords = largeurs.map((_, i) =>
    largeurs.slice(0, i).reduce((a, b) => a + b, X),
  );

  const hEntete = 9;
  doc.setFillColor(...COULEURS.encre);
  doc.rect(X, y, LARGEUR, hEntete, "F");
  police(doc, "corpsGras", 8.5);
  doc.setTextColor(...COULEURS.blanc);
  COLONNES.forEach((c, i) => doc.text(c.titre, bords[i]! + 2.5, y + 6));
  y += hEntete;

  const hautTableau = y;
  // La hauteur d'une ligne suit l'effectif : assez haute pour qu'on y signe
  // quand le groupe est petit, resserrée quand il est nombreux.
  const place = BAS_TABLEAU - y;
  const hLigne = Math.max(
    6,
    Math.min(11, f.stagiaires.length > 0 ? place / f.stagiaires.length : 11),
  );

  f.stagiaires.forEach((s, i) => {
    if (i % 2 === 1) {
      doc.setFillColor(250, 251, 252);
      doc.rect(X, y, LARGEUR, hLigne, "F");
    }
    doc.setDrawColor(...COULEURS.bordure).setLineWidth(0.2);
    doc.line(X, y, X + LARGEUR, y);

    const milieu = y + hLigne / 2 + 1.4;
    police(doc, "mono", 8);
    doc.setTextColor(...COULEURS.ardoiseClaire);
    doc.text(String(i + 1), bords[0]! + 2.5, milieu);

    // Le CEF est borné à sa colonne : la base en contient d'anormalement
    // longs — une saisie fautive — et celui-là passait par-dessus le nom du
    // stagiaire suivant dans la colonne d'à côté.
    police(doc, "mono", 8.5);
    doc.setTextColor(...COULEURS.corps);
    doc.text(
      (doc.splitTextToSize(s.cef ?? "—", largeurs[1]! - 5) as string[])[0] ?? "",
      bords[1]! + 2.5,
      milieu,
    );

    police(doc, "corpsGras", 9);
    doc.setTextColor(...COULEURS.encre);
    doc.text(
      (doc.splitTextToSize(s.nom, largeurs[2]! - 5) as string[])[0] ?? "",
      bords[2]! + 2.5,
      milieu,
    );
    y += hLigne;
  });

  // Le cadre du tableau et ses séparateurs verticaux, tracés après les lignes
  // pour rester au-dessus des fonds alternés.
  doc.setDrawColor(...COULEURS.bordureForte).setLineWidth(0.3);
  doc.rect(X, hautTableau - hEntete, LARGEUR, y - hautTableau + hEntete);
  doc.setDrawColor(...COULEURS.bordure).setLineWidth(0.2);
  bords.slice(1).forEach((b) => doc.line(b, hautTableau - hEntete, b, y));

  // ── La signature du formateur ────────────────────────────────────────────
  //
  // En bas, seule : c'est lui qui atteste de la présence, après que chacun a
  // signé la sienne.
  y = Math.max(y + 12, 246);
  police(doc, "mono", 6.8);
  doc.setTextColor(...COULEURS.ardoiseClaire);
  doc.text("LE FORMATEUR", X + LARGEUR - 70, y);

  police(doc, "corps", 8.5);
  doc.setTextColor(...COULEURS.corps);
  const signataire = [
    f.identification.formateur,
    f.identification.matricule ? `mat. ${f.identification.matricule}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  if (signataire) doc.text(signataire, X + LARGEUR - 70, y + 5);

  doc.setDrawColor(...COULEURS.bordureForte).setLineWidth(0.3);
  doc.line(X + LARGEUR - 70, y + 26, X + LARGEUR, y + 26);
  police(doc, "corps", 7.5);
  doc.setTextColor(...COULEURS.ardoiseClaire);
  doc.text("Date et signature", X + LARGEUR - 70, y + 30);

  // ── Pied de page ─────────────────────────────────────────────────────────
  const page = doc.getCurrentPageInfo().pageNumber;
  doc.setPage(page);
  police(doc, "corps", 7.5);
  doc.setTextColor(...COULEURS.muet);
  doc.text(`Feuille d'émargement — ${f.titre}`, X, 289, {
    maxWidth: LARGEUR - 30,
  });
}

export async function telechargerEmargementPdf(
  f: FeuilleEmargement,
  nomFichier: string,
  marque?: Marque,
): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  await installerPolices(doc);
  dessinerEmargement(doc, f, marque);
  doc.save(nomFichier);
}
