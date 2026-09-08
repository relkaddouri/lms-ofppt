import { jsPDF } from "jspdf";
import { dessinerEntete, type Marque } from "@/lib/pdf-marque";
import { COULEURS, installerPolices, police } from "@/lib/pdf-theme";
import { insecable } from "@/lib/typographie";

/**
 * Résultat publié d'un contrôle, à imprimer et faire signer (PRD §4.7).
 *
 * Distinct de la copie corrigée (`pdf-copie`) : celle-ci sert à rendre le
 * détail des réponses, celui-ci sert de preuve. Le §4.7 le dit comme tel — un
 * document imprimé, pas un écran, avec deux zones de signature manuscrite. La
 * signature n'est jamais capturée dans l'application : le stagiaire signe sur
 * le papier, comme un document administratif.
 *
 * L'attestation au-dessus de la ligne du stagiaire est la raison d'être du
 * document : elle vaut vérification contradictoire face à la Direction si une
 * note est contestée plus tard. Elle est reprise mot pour mot du PRD.
 */

export type LigneResultat = {
  enonce: string;
  bareme: number;
  points: number;
  /** Ce que le stagiaire a écrit. Absent des documents produits avant §4.7. */
  reponse?: string | null;
  /** La réponse attendue, telle que le formateur l'a préparée. */
  corrige?: string | null;
  /** Ce que le formateur a écrit sur cette question en particulier. */
  commentaire?: string | null;
};

export type ResultatControle = {
  titre: string;
  stagiaire: string;
  /** Groupe, module, code opérationnel — ce qui situe l'épreuve. */
  contexte?: string | null;
  /** « Contrôle continu » ou « Épreuve de fin de module ». */
  nature: string;
  dateEpreuve?: string | null;
  datePublication: string;
  note: number;
  total: number;
  lignes: LigneResultat[];
};

const X = 16;
const LARGEUR = 178;

/** Le texte d'attestation, validé par le porteur de projet (PRD §4.7). */
export function attestation(stagiaire: string): string {
  return `Je soussigné(e) ${stagiaire}, déclare avoir pris connaissance du présent résultat, vérifié le recalcul des points obtenus, et atteste qu'il est exact.`;
}

export async function construireResultatPdf(
  r: ResultatControle,
  marque?: Marque,
): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  await installerPolices(doc);

  let y = dessinerEntete(doc, marque, X, 14, LARGEUR) + 6;

  police(doc, "titre", 16);
  doc.setTextColor(...COULEURS.encre);
  doc.text("Résultat d'évaluation", X, y);
  y += 8;

  police(doc, "corps", 10);
  doc.setTextColor(...COULEURS.corps);
  doc.text(r.titre, X, y);
  y += 5;

  police(doc, "corps", 9);
  doc.setTextColor(...COULEURS.ardoise);
  const situe = [r.nature, r.contexte, r.dateEpreuve ? `épreuve du ${r.dateEpreuve}` : null]
    .filter(Boolean)
    .join(" · ");
  doc.text(situe, X, y);
  y += 8;

  doc.setDrawColor(...COULEURS.bordureForte).setLineWidth(0.4);
  doc.line(X, y, X + LARGEUR, y);
  y += 9;

  // ── Identité et note ─────────────────────────────────────────────────────
  police(doc, "corps", 9);
  doc.setTextColor(...COULEURS.ardoise);
  doc.text("STAGIAIRE", X, y);
  doc.text("NOTE", X + LARGEUR, y, { align: "right" });
  y += 6;

  police(doc, "titre", 13);
  doc.setTextColor(...COULEURS.encre);
  doc.text(r.stagiaire, X, y);
  police(doc, "titre", 18);
  doc.text(`${r.note} / ${r.total}`, X + LARGEUR, y + 1, { align: "right" });
  y += 12;

  // ── Le détail des points, ce que l'attestation dit avoir vérifié ─────────
  //
  // Sans lui, « vérifié le recalcul des points obtenus » ne veut rien dire :
  // le stagiaire doit avoir sous les yeux ce qu'il atteste avoir recompté.
  //
  // Et pas seulement les points. Une note ne se vérifie pas contre elle-même :
  // il faut relire ce qu'on a écrit, ce qui était attendu, et ce que le
  // formateur en a dit. Les trois sont donc ici, sous chaque question. C'est ce
  // qui distingue ce document d'un relevé de notes.
  police(doc, "corps", 9);
  doc.setTextColor(...COULEURS.ardoise);
  doc.text("DÉTAIL PAR QUESTION", X, y);
  y += 5;

  doc.setDrawColor(...COULEURS.separateur).setLineWidth(0.2);
  doc.line(X, y, X + LARGEUR, y);
  y += 5;

  const INTERLIGNE = 4.4;
  /** Le retrait des trois blocs sous un énoncé. */
  const RETRAIT = 6;
  /** Le haut d'une page ajoutée, et le bas sous lequel plus rien ne s'écrit. */
  const HAUT = 20;
  const BAS = 268;

  /** Écrit un texte replié en changeant de page au besoin. */
  const couler = (
    texte: string,
    x: number,
    largeur: number,
    depart: number,
    couleur: readonly [number, number, number],
    pt = 8.5,
  ): number => {
    police(doc, "corps", pt);
    const lignes: string[] = doc.splitTextToSize(insecable(texte), largeur);
    let curseur = depart;
    for (const ligne of lignes) {
      if (curseur > BAS) {
        doc.addPage();
        curseur = HAUT;
      }
      police(doc, "corps", pt);
      doc.setTextColor(...couleur);
      doc.text(ligne, x, curseur);
      curseur += 4;
    }
    return curseur;
  };

  r.lignes.forEach((l, i) => {
    police(doc, "corpsGras", 9);
    const enonce: string[] = doc.splitTextToSize(
      insecable(`${i + 1}. ${l.enonce}`),
      LARGEUR - 30,
    );

    // L'énoncé est écrit en entier. N'en garder que la première ligne le
    // coupait en silence — « en trois temps : humain, comparé, » — sur un
    // document qui vaut preuve : le stagiaire signait pour une question dont
    // il manquait la fin, et c'est précisément ce que l'attestation prétend
    // établir.

    /** Ce qu'un bloc étiqueté occupera, 0 s'il n'a rien à dire. */
    const hauteurBloc = (texte: string | null | undefined): number => {
      if (!texte?.trim()) return 0;
      police(doc, "corps", 8.5);
      const n: number = doc.splitTextToSize(
        insecable(texte.trim()),
        LARGEUR - RETRAIT,
      ).length;
      return 3.8 + n * 4 + 1.8;
    };

    // Une question passe d'un bloc sur la page suivante plutôt que d'être
    // coupée en deux : c'est ainsi qu'un commentaire se retrouvait seul en
    // tête de page, détaché de la question qu'il commente — et donc manqué par
    // celui qui relit avant de signer. Une question plus haute qu'une page
    // entière reste coupée, faute de mieux, et ses blocs se répartissent.
    const hauteurQuestion =
      enonce.length * INTERLIGNE +
      1.6 +
      hauteurBloc(l.reponse) +
      hauteurBloc(l.corrige) +
      hauteurBloc(l.commentaire);

    if (y + hauteurQuestion > BAS && hauteurQuestion <= BAS - HAUT) {
      doc.addPage();
      y = HAUT;
    } else if (y + enonce.length * INTERLIGNE + 12 > BAS) {
      doc.addPage();
      y = HAUT;
    }

    const yEnonce = y;
    police(doc, "corpsGras", 9);
    doc.setTextColor(...COULEURS.encre);
    enonce.forEach((ligne, k) => doc.text(ligne, X, y + k * INTERLIGNE));

    // La note reste alignée sur la première ligne de l'énoncé : c'est là qu'on
    // la cherche du regard en descendant la colonne.
    police(doc, "mono", 9);
    doc.setTextColor(...COULEURS.encre);
    doc.text(`${l.points} / ${l.bareme}`, X + LARGEUR, yEnonce, {
      align: "right",
    });
    y += enonce.length * INTERLIGNE + 1.6;

    /** Un bloc étiqueté sous l'énoncé, sauté s'il n'a rien à dire. */
    const bloc = (
      etiquette: string,
      texte: string | null | undefined,
      couleurEtiquette: readonly [number, number, number],
    ) => {
      if (!texte?.trim()) return;
      // L'étiquette ne se sépare pas de sa première ligne.
      if (y + 8 > BAS) {
        doc.addPage();
        y = HAUT;
      }
      police(doc, "mono", 7);
      doc.setTextColor(...couleurEtiquette);
      doc.text(etiquette, X + RETRAIT, y);
      y = couler(texte.trim(), X + RETRAIT, LARGEUR - RETRAIT, y + 3.8, COULEURS.corps);
      y += 1.8;
    };

    // La réponse attendue porte le seul point de couleur : c'est ce que le
    // stagiaire cherche en premier quand il conteste un point.
    bloc("VOTRE RÉPONSE", l.reponse, COULEURS.ardoiseClaire);
    bloc("RÉPONSE ATTENDUE", l.corrige, COULEURS.sarcelle);
    bloc("COMMENTAIRE DU FORMATEUR", l.commentaire, COULEURS.ardoiseClaire);

    y += 1.5;
    if (i < r.lignes.length - 1 && y < BAS) {
      doc.setDrawColor(...COULEURS.separateur).setLineWidth(0.2);
      doc.line(X, y, X + LARGEUR, y);
      y += 5;
    }
  });

  if (y + 24 > BAS) {
    doc.addPage();
    y = HAUT;
  }
  y += 2;
  doc.setDrawColor(...COULEURS.bordureForte).setLineWidth(0.4);
  doc.line(X, y, X + LARGEUR, y);
  y += 6;
  police(doc, "corpsGras", 10);
  doc.setTextColor(...COULEURS.encre);
  doc.text("Total", X, y);
  police(doc, "mono", 11);
  doc.text(`${r.note} / ${r.total}`, X + LARGEUR, y, { align: "right" });
  y += 14;

  // ── Les deux signatures ──────────────────────────────────────────────────
  //
  // Réservées d'un bloc : une zone de signature coupée en deux par un saut de
  // page ne se fait pas signer. Si la place manque, la page suivante les
  // accueille entières.
  const HAUTEUR_SIGNATURES = 62;
  if (y + HAUTEUR_SIGNATURES > 280) {
    doc.addPage();
    y = 24;
  }

  const colonne = (LARGEUR - 10) / 2;

  police(doc, "corps", 9);
  doc.setTextColor(...COULEURS.ardoise);
  doc.text("SIGNATURE DU FORMATEUR", X, y);
  doc.text("SIGNATURE DU STAGIAIRE", X + colonne + 10, y);
  const hautCadres = y + 3;

  // L'attestation vit au-dessus de la ligne du stagiaire, jamais de celle du
  // formateur : c'est lui qui déclare, pas le formateur à sa place.
  police(doc, "corps", 7.5);
  doc.setTextColor(...COULEURS.corps);
  const texteAttestation: string[] = doc.splitTextToSize(
    attestation(r.stagiaire),
    colonne - 4,
  );
  texteAttestation.forEach((l, i) => {
    doc.text(l, X + colonne + 12, hautCadres + 6 + i * 3.4);
  });

  const basLignes = hautCadres + 44;
  doc.setDrawColor(...COULEURS.bordureForte).setLineWidth(0.3);
  doc.line(X, basLignes, X + colonne, basLignes);
  doc.line(X + colonne + 10, basLignes, X + LARGEUR, basLignes);

  police(doc, "corps", 7.5);
  doc.setTextColor(...COULEURS.ardoiseClaire);
  doc.text("Date et signature", X, basLignes + 4);
  doc.text("Date et signature", X + colonne + 10, basLignes + 4);

  // ── Pied de page ─────────────────────────────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    police(doc, "corps", 7.5);
    doc.setTextColor(...COULEURS.muet);
    doc.text(
      `${r.stagiaire} — ${r.titre} — résultat publié le ${r.datePublication}`,
      X,
      289,
      { maxWidth: LARGEUR - 30 },
    );
    doc.text(`Page ${p} / ${pages}`, X + LARGEUR, 289, { align: "right" });
  }

  return doc;
}

export async function telechargerResultatPdf(
  r: ResultatControle,
  nomFichier: string,
  marque?: Marque,
) {
  const doc = await construireResultatPdf(r, marque);
  doc.save(nomFichier);
}
