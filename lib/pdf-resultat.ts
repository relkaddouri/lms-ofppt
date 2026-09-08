import { jsPDF } from "jspdf";
import { dessinerLogo, type Marque } from "@/lib/pdf-marque";
import { COULEURS, installerPolices, police } from "@/lib/pdf-theme";
import { insecable } from "@/lib/typographie";
import { dessinerQr, tailleQr } from "@/lib/pdf-qr";

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

/**
 * Le cartouche d'identification, en tête du document.
 *
 * Un résultat signé est une pièce administrative : il doit dire de lui-même
 * d'où il vient, sans qu'on ait à ouvrir l'application. Établissement,
 * filière, groupe, module, formateur, épreuve, date et horaire — c'est ce que
 * la Direction cherche en le prenant en main, et ce qu'aucune ligne de
 * contexte en petits caractères ne remplaçait.
 *
 * Chaque champ est facultatif : une ligne sans valeur ne s'imprime pas plutôt
 * que d'afficher une étiquette sur du vide.
 */
export type Identification = {
  etablissement?: string | null;
  /** Le Code d'Enregistrement du Formé — l'identifiant OFPPT du stagiaire. */
  cef?: string | null;
  filiere?: string | null;
  groupe?: string | null;
  anneeScolaire?: string | null;
  module?: string | null;
  formateur?: string | null;
  matricule?: string | null;
  /** « Lundi 07/09/2026 ». */
  dateEpreuve?: string | null;
  /** « de 8 h 30 à 11 h · 2 h 30 », déduit de l'emploi du temps. */
  horaire?: string | null;
};

export type ResultatControle = {
  titre: string;
  stagiaire: string;
  /** « Contrôle continu » ou « Épreuve de fin de module ». */
  nature: string;
  datePublication: string;
  note: number;
  total: number;
  /** L'identifiant de la copie, porté par le QR code au bas du document. */
  reference: string;
  identification: Identification;
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

  // ── En-tête : le logo seul ───────────────────────────────────────────────
  //
  // Le nom du centre n'est plus posé à côté du logo : il le répétait presque
  // mot pour mot, et les deux se disputaient la largeur. Il descend dans le
  // cartouche, où il est une donnée du document parmi les autres.
  const largeurLogo = dessinerLogo(doc, marque, X, 13, 13, LARGEUR * 0.4);

  police(doc, "titre", 17);
  doc.setTextColor(...COULEURS.encre);
  doc.text("Résultat d'évaluation", X + (largeurLogo > 0 ? largeurLogo + 7 : 0), 22);

  police(doc, "mono", 8);
  doc.setTextColor(...COULEURS.ardoiseClaire);
  doc.text(r.nature.toLocaleUpperCase("fr"), X + LARGEUR, 17, { align: "right" });
  police(doc, "corps", 8.5);
  doc.setTextColor(...COULEURS.ardoise);
  doc.text(`Publié le ${r.datePublication}`, X + LARGEUR, 22, { align: "right" });

  let y = 32;

  // ── Cartouche d'identification ───────────────────────────────────────────
  //
  // Un tableau à filets plutôt qu'une ligne de texte gris : c'est la forme
  // qu'ont les documents de l'établissement, et surtout la seule qui se
  // parcoure du regard quand on cherche un champ précis.
  const id = r.identification;
  const rangs: [string, string | null | undefined][][] = [
    [["ÉTABLISSEMENT", id.etablissement]],
    [
      ["FILIÈRE", id.filiere],
      ["ANNÉE SCOLAIRE", id.anneeScolaire],
    ],
    [
      ["GROUPE", id.groupe],
      ["FORMATEUR", [id.formateur, id.matricule && `mat. ${id.matricule}`]
        .filter(Boolean)
        .join(" · ") || null],
    ],
    [["MODULE", id.module]],
    [["ÉPREUVE", r.titre]],
    [
      ["DATE", id.dateEpreuve],
      ["HORAIRE", id.horaire],
    ],
  ];

  const retenus = rangs
    .map((rang) => rang.filter(([, valeur]) => valeur?.trim()))
    .filter((rang) => rang.length > 0);

  if (retenus.length > 0) {
    const LARGEUR_ETIQUETTE = 30;
    const hautCartouche = y;

    retenus.forEach((rang, i) => {
      const colonne = LARGEUR / rang.length;
      const place = colonne - LARGEUR_ETIQUETTE - 6;

      // La hauteur du rang suit son contenu. Fixée à une ligne, elle coupait
      // « Digital Design, option UX Design · 2e année » au milieu du mot — sur
      // un cartouche d'identification, une valeur tronquée ne vaut rien.
      police(doc, "corps", 8.8);
      const cellules = rang.map(([etiquette, valeur]) => ({
        etiquette,
        lignes: doc.splitTextToSize(insecable(valeur!.trim()), place) as string[],
      }));
      const hauteur = Math.max(
        8,
        ...cellules.map((c) => c.lignes.length * 4.2 + 3.6),
      );

      if (i > 0) {
        doc.setDrawColor(...COULEURS.bordure).setLineWidth(0.2);
        doc.line(X, y, X + LARGEUR, y);
      }
      cellules.forEach((cellule, k) => {
        const cx = X + k * colonne;
        if (k > 0) {
          doc.setDrawColor(...COULEURS.bordure).setLineWidth(0.2);
          doc.line(cx, y, cx, y + hauteur);
        }
        police(doc, "mono", 6.8);
        doc.setTextColor(...COULEURS.ardoiseClaire);
        doc.text(cellule.etiquette, cx + 3, y + 5.4);
        police(doc, "corps", 8.8);
        doc.setTextColor(...COULEURS.encre);
        cellule.lignes.forEach((ligne, l) =>
          doc.text(ligne, cx + LARGEUR_ETIQUETTE, y + 5.4 + l * 4.2),
        );
      });
      y += hauteur;
    });

    doc.setDrawColor(...COULEURS.bordureForte).setLineWidth(0.3);
    doc.rect(X, hautCartouche, LARGEUR, y - hautCartouche);
    y += 9;
  }

  // ── Identité et note ─────────────────────────────────────────────────────
  //
  // Sur fond encre : c'est la seule information qu'on cherche à un mètre de
  // distance, et un document administratif la met en évidence plutôt que de
  // la fondre dans le corps du texte.
  const HAUTEUR_BANDE = 16;
  doc.setFillColor(...COULEURS.encre);
  doc.rect(X, y, LARGEUR, HAUTEUR_BANDE, "F");

  police(doc, "mono", 6.8);
  doc.setTextColor(...COULEURS.ardoiseClaire);
  doc.text("STAGIAIRE", X + 4, y + 5.6);
  doc.text("NOTE", X + LARGEUR - 4, y + 5.6, { align: "right" });

  police(doc, "titre", 13);
  doc.setTextColor(...COULEURS.blanc);
  doc.text(r.stagiaire, X + 4, y + 12.4);
  // Le CEF suit le nom : c'est lui qui distingue deux homonymes, et il n'a de
  // sens qu'accolé à celui qu'il identifie. La largeur du nom se mesure avec
  // la police du nom, avant d'en changer.
  const largeurNom = doc.getTextWidth(r.stagiaire);
  if (id.cef?.trim()) {
    police(doc, "mono", 8);
    doc.setTextColor(...COULEURS.ardoiseClaire);
    doc.text(`CEF ${id.cef.trim()}`, X + 4 + largeurNom + 4, y + 12.4);
  }
  police(doc, "titre", 15);
  doc.text(`${r.note} / ${r.total}`, X + LARGEUR - 4, y + 12.6, {
    align: "right",
  });
  y += HAUTEUR_BANDE + 10;

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

    const coupe =
      (y + hauteurQuestion > BAS && hauteurQuestion <= BAS - HAUT) ||
      y + enonce.length * INTERLIGNE + 12 > BAS;
    if (coupe) {
      doc.addPage();
      y = HAUT;
    } else if (i > 0) {
      // Le filet sépare deux questions ; il se pose donc avant la suivante et
      // non après la précédente, sans quoi il restait seul en bas d'une page
      // dont la question suivante était partie.
      doc.setDrawColor(...COULEURS.separateur).setLineWidth(0.2);
      doc.line(X, y, X + LARGEUR, y);
      y += 5;
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

  // ── Le sceau : un QR code sous les signatures ────────────────────────────
  //
  // Ce que le document affirme sur papier, le code le porte sous forme
  // lisible par une machine : qui, quelle note, quelle épreuve, et la
  // référence de la copie. Un exemplaire imprimé se vérifie alors d'un coup
  // de téléphone, sans ouvrir l'application — c'est ce qui distingue une
  // pièce signée d'une feuille imprimable par n'importe qui.
  //
  // Le contenu est du texte simple et non une URL : un téléphone l'affiche
  // tel quel, sans réseau et sans page à ouvrir.
  const sceau = [
    "PÉDAGO — RÉSULTAT D'ÉVALUATION",
    `Stagiaire : ${r.stagiaire}`,
    id.cef?.trim() ? `CEF : ${id.cef.trim()}` : null,
    `Note : ${r.note} / ${r.total}`,
    [r.nature, id.module, id.dateEpreuve].filter(Boolean).join(" · "),
    `Réf. : ${r.reference}`,
  ]
    .filter(Boolean)
    .join("\n");

  // La taille suit la densité du code : un QR plus fourni a des modules plus
  // fins, et sous 0,6 mm un téléphone ne le lit plus sur une impression
  // ordinaire. On l'agrandit plutôt que de laisser le code devenir illisible.
  const modules = tailleQr(sceau);
  const COTE = Math.max(24, Math.min(34, modules * 0.62));
  const yQr = basLignes + 12;

  dessinerQr(doc, sceau, X, yQr, COTE);

  police(doc, "mono", 6.8);
  doc.setTextColor(...COULEURS.ardoiseClaire);
  doc.text("VÉRIFICATION", X + COTE + 6, yQr + 4);

  police(doc, "corps", 8);
  doc.setTextColor(...COULEURS.corps);
  const explication: string[] = doc.splitTextToSize(
    insecable(
      "Ce code porte le nom du stagiaire, sa note et la référence de cette copie. Le lire avec un téléphone permet de vérifier qu'un exemplaire imprimé correspond bien au résultat publié.",
    ),
    LARGEUR - COTE - 6,
  );
  explication.forEach((ligne, i) =>
    doc.text(ligne, X + COTE + 6, yQr + 10 + i * 4),
  );

  police(doc, "mono", 7);
  doc.setTextColor(...COULEURS.ardoiseClaire);
  doc.text(
    `Réf. ${r.reference}`,
    X + COTE + 6,
    yQr + 10 + explication.length * 4 + 3,
  );

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
