import { jsPDF } from "jspdf";
import type { Marque } from "@/lib/pdf-marque";
import { dessinerCartouche, LARGEUR, X } from "@/lib/pdf-cartouche";
import { COULEURS, installerPolices, police } from "@/lib/pdf-theme";
import { insecable } from "@/lib/typographie";
import { dessinerQr, tailleQr } from "@/lib/pdf-qr";
import { dessinerMarkdown, mesurerMarkdown } from "@/lib/pdf-markdown";
import { corrigeStructure } from "@/lib/corrige";
import type {
  Identification,
  LigneResultat,
  ResultatControle,
} from "@/lib/resultat";

export type { Identification, LigneResultat, ResultatControle };

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

/** Le texte d'attestation, validé par le porteur de projet (PRD §4.7). */
export function attestation(stagiaire: string): string {
  return `Je soussigné(e) ${stagiaire}, déclare avoir pris connaissance du présent résultat, vérifié le recalcul des points obtenus, et atteste qu'il est exact.`;
}

/**
 * Dessine un résultat dans un document, à partir de la page courante.
 *
 * Séparé de la création du document pour que le lot puisse enchaîner les
 * copies dans un seul fichier : le formateur qui publie une classe entière
 * lance une impression, pas vingt-cinq.
 */
export function dessinerResultat(
  doc: jsPDF,
  r: ResultatControle,
  marque?: Marque,
): void {
  const premierePage = doc.getCurrentPageInfo().pageNumber;
  const id = r.identification;
  let y = dessinerCartouche(
    doc,
    {
      titre: "Résultat d'évaluation",
      nature: r.nature,
      epreuve: r.titre,
      mention: `Publié le ${r.datePublication}`,
      identification: id,
    },
    marque,
  );
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
  // Les identifiants suivent le nom : ils distinguent deux homonymes, et
  // n'ont de sens qu'accolés à celui qu'ils identifient. La largeur du nom se
  // mesure avec la police du nom, avant d'en changer.
  const largeurNom = doc.getTextWidth(r.stagiaire);
  const identifiants = [
    id.cef?.trim() ? `CEF ${id.cef.trim()}` : null,
    id.cne?.trim() ? `CNE ${id.cne.trim()}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  if (identifiants) {
    police(doc, "mono", 8);
    doc.setTextColor(...COULEURS.ardoiseClaire);
    doc.text(identifiants, X + 4 + largeurNom + 4, y + 12.4);
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

  /** Le retrait du texte d'un bloc, filet compris. */
  const RETRAIT_TEXTE = RETRAIT + 5;

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
      curseur += 4.4;
    }
    return curseur;
  };

  r.lignes.forEach((l, i) => {
    police(doc, "corpsGras", 9.5);
    const enonce: string[] = doc.splitTextToSize(
      insecable(l.enonce),
      LARGEUR - 42,
    );

    // L'énoncé est écrit en entier. N'en garder que la première ligne le
    // coupait en silence — « en trois temps : humain, comparé, » — sur un
    // document qui vaut preuve : le stagiaire signait pour une question dont
    // il manquait la fin, et c'est précisément ce que l'attestation prétend
    // établir.

    /**
     * Ce qu'un bloc étiqueté occupera, 0 s'il n'a rien à dire.
     *
     * Mesuré par le moteur qui dessinera, comme le fond du bloc. L'ancienne
     * formule comptait les lignes du Markdown brut : pour un tableau, elle
     * additionnait les barres verticales et les tirets, et annonçait deux à
     * trois fois la hauteur réelle. Une question se croyait alors trop haute
     * pour la page et partait à la suivante, laissant les deux tiers d'une
     * feuille blancs.
     */
    const hauteurBloc = (texte: string | null | undefined): number => {
      if (!texte?.trim()) return 0;
      return (
        2.6 +
        6 +
        mesurerMarkdown(doc, texte.trim(), LARGEUR - RETRAIT_TEXTE - 4) +
        3 +
        4
      );
    };

    /*
      Quand couper une page.

      On ne déplace plus une question entière faute de place : sur un dossier
      d'une trentaine de pages, cela laissait des demi-feuilles blanches à
      chaque question longue, et le papier compte.

      Ce qu'on protège, c'est l'orphelin : un énoncé seul en bas de page, dont
      la réponse commence à la suivante. On exige donc que l'énoncé tienne
      avec le début de son premier bloc — étiquette et premières lignes. Au-
      delà, les blocs se répartissent, chacun gardant son étiquette avec lui.
    */
    const DEBUT_UTILE = 24;
    const coupe = y + enonce.length * INTERLIGNE + DEBUT_UTILE > BAS;
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

    // Le numéro dans une pastille encre : il ancre la question et remplace le
    // « 1. » collé à l'énoncé, qu'on ne distinguait pas du texte.
    doc.setFillColor(...COULEURS.encre);
    doc.roundedRect(X, yEnonce - 3.4, 7, 5.6, 1, 1, "F");
    police(doc, "mono", 7.5);
    doc.setTextColor(...COULEURS.blanc);
    doc.text(String(i + 1), X + 3.5, yEnonce + 0.6, { align: "center" });

    police(doc, "corpsGras", 9.5);
    doc.setTextColor(...COULEURS.encre);
    enonce.forEach((ligne, k) => doc.text(ligne, X + 10, y + k * INTERLIGNE));

    // La note dans une pastille elle aussi, alignée sur la première ligne de
    // l'énoncé : c'est là qu'on la cherche en descendant la colonne, et un
    // chiffre encadré se retrouve plus vite qu'un chiffre posé.
    const note = `${l.points} / ${l.bareme}`;
    police(doc, "mono", 8.5);
    const largeurNote = doc.getTextWidth(note) + 7;
    doc.setFillColor(...COULEURS.lavis);
    doc.roundedRect(
      X + LARGEUR - largeurNote,
      yEnonce - 3.6,
      largeurNote,
      6,
      1.2,
      1.2,
      "F",
    );
    doc.setTextColor(...COULEURS.encre);
    doc.text(note, X + LARGEUR - largeurNote / 2, yEnonce + 0.7, {
      align: "center",
    });
    y += enonce.length * INTERLIGNE + 2.4;

    /**
     * Un bloc étiqueté sous l'énoncé, sauté s'il n'a rien à dire.
     *
     * Un filet vertical le tient, et un fond léger distingue la réponse
     * attendue. Sans eux, les trois blocs n'étaient séparés que par une
     * étiquette de sept points : on ne savait pas, en diagonale, où finissait
     * ce que le stagiaire avait écrit et où commençait ce qu'on attendait.
     */
    const bloc = (
      etiquette: string,
      texte: string | null | undefined,
      accent: readonly [number, number, number],
      fond?: readonly [number, number, number],
    ) => {
      if (!texte?.trim()) return;

      /*
        Les mesures du bloc, nommées plutôt qu'additionnées au fil du code.
        Les chiffres s'étaient accumulés au point que le fond finissait
        0,4 mm AU-DESSUS de la dernière ligne : le texte en sortait par le
        bas, d'un cheveu, sur les réponses attendues les plus longues.

                      ╭───────────────────  haut − MARGE_HAUT
          MARGE_HAUT  │
                      │  ÉTIQUETTE          haut + 1
             ÉCART    │
                      │  contenu…           haut + ÉCART
                      │
          MARGE_BAS   │
                      ╰───────────────────  bas du fond
      */
      const MARGE_HAUT = 2.6;
      // L'écart ne se lit pas seul : le moteur Markdown descend encore d'un
      // interligne avant d'écrire sa première ligne. Avec 6 mm ici, l'étiquette
      // se retrouvait à 9,6 mm de son texte — un trou que rien ne justifie sur
      // une pièce qu'on veut dense. 2,5 mm donnent 7,1 mm au total.
      const ECART = 2.5;
      const MARGE_BAS = 3;

      const contenu = mesurerMarkdown(
        doc,
        texte.trim(),
        LARGEUR - RETRAIT_TEXTE - 4,
      );
      const hauteur = MARGE_HAUT + ECART + contenu + MARGE_BAS;

      // L'étiquette ne se sépare pas de sa première ligne.
      if (y + Math.min(hauteur, 12) > BAS) {
        doc.addPage();
        y = HAUT;
      }
      const haut = y;

      /*
        Le fond et le filet se tracent AVANT le texte, et d'après la hauteur
        mesurée — jamais d'après l'ordonnée atteinte après coup. Un bloc dont
        le texte passait sur la page suivante faisait courir son filet depuis
        l'ordonnée d'arrivée : sur la page des signatures, un trait traversait
        toute la feuille jusque sous le code de vérification.

        Quand le bloc dépasse la page, l'un et l'autre s'arrêtent en bas de
        celle-ci. Le texte reprend à la page suivante sans fond ni filet : un
        second cadre sans son étiquette ne voudrait rien dire.
      */
      const visible = Math.min(hauteur, BAS - (haut - MARGE_HAUT));
      if (fond) {
        doc.setFillColor(...fond);
        doc.rect(X + RETRAIT, haut - MARGE_HAUT, LARGEUR - RETRAIT, visible, "F");
      }
      doc.setFillColor(...accent);
      doc.rect(X + RETRAIT, haut - MARGE_HAUT, 0.9, visible, "F");

      police(doc, "mono", 7);
      doc.setTextColor(...accent);
      doc.text(etiquette, X + RETRAIT_TEXTE, haut + 1);

      // Le contenu passe par le moteur Markdown : les stagiaires rendent
      // maintenant des tableaux — fiches persona, user journey maps — et des
      // schémas, que `couler` imprimait en barres verticales et en JSON. Un
      // dossier remis à l'administration ne peut pas montrer la syntaxe
      // d'écriture à la place du travail.
      y = haut + ECART;
      const pagesAvant = doc.getNumberOfPages();
      dessinerMarkdown(doc, texte.trim(), {
        x: X + RETRAIT_TEXTE,
        largeur: LARGEUR - RETRAIT_TEXTE - 4,
        y,
        place: (h) => {
          if (y + h > BAS) {
            doc.addPage();
            y = HAUT;
          }
          y += h;
          return y;
        },
      });

      /*
        On repart du bas du fond plutôt que de la dernière ligne : sans quoi le
        bloc suivant venait se loger dans la marge basse de celui-ci.

        Mais seulement si le contenu est resté sur la même page. S'il a changé
        de page, `haut` appartient à la feuille précédente et le bas du fond
        calculé à partir de lui tombe loin sous celle-ci : le bloc suivant se
        croyait alors en bas de page et sautait à la suivante, abandonnant les
        deux tiers d'une feuille.
      */
      y =
        doc.getNumberOfPages() === pagesAvant
          ? Math.max(y + MARGE_BAS, haut - MARGE_HAUT + hauteur)
          : y + MARGE_BAS;

      // L'espace entre deux blocs : il sépare « votre réponse » de « réponse
      // attendue », et celle-ci du commentaire. Trop court, les trois se
      // lisaient comme un seul pavé.
      y += 4;
    };

    // La réponse attendue porte le seul point de couleur et le seul fond :
    // c'est ce qu'on cherche en premier quand on conteste un point.
    // L'étiquette prend la couleur de son filet. Elle doit donc rester une
    // couleur de TEXTE : « commentaire du formateur » portait jusqu'ici une
    // couleur de bordure, à 1,53:1 sur blanc — invisible une fois imprimée.
    bloc("VOTRE RÉPONSE", l.reponse, COULEURS.ardoise);
    // Mise en forme à l'affichage, pas en base : le texte du formateur
    // reste le sien, mot pour mot. Les corrigés déjà écrits énumèrent dans
    // le fil de la phrase, et c'est illisible sur une pièce qu'on dépose.
    bloc(
      "RÉPONSE ATTENDUE",
      l.corrige ? corrigeStructure(l.corrige) : l.corrige,
      COULEURS.sarcelle,
      [233, 242, 247],
    );
    bloc("COMMENTAIRE DU FORMATEUR", l.commentaire, COULEURS.ardoise);

    // Entre deux questions, davantage qu'entre deux blocs d'une même question :
    // c'est ce qui fait voir, en diagonale, où une question s'achève.
    y += 5;
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
    id.cne?.trim() ? `CNE : ${id.cne.trim()}` : null,
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

  // Le pied de page s'écrit à 289 mm sur chaque feuille. Le code de
  // vérification était posé douze millimètres sous les signatures sans qu'on
  // regarde s'il restait de la place : sur une copie longue, il descendait
  // jusque sur la ligne du pied, qui le traversait.
  //
  // On resserre d'abord, et on ne change de page qu'en dernier recours : une
  // feuille de plus par copie coûterait plus que ces quelques millimètres.
  const BAS_UTILE = 283;
  let yQr = basLignes + 12;
  if (yQr + COTE > BAS_UTILE) yQr = BAS_UTILE - COTE;
  if (yQr < basLignes + 4) {
    doc.addPage();
    yQr = HAUT;
  }

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
  //
  // Numéroté à l'intérieur du résultat et non du fichier : dans un lot, le
  // stagiaire reçoit ses deux pages détachées du reste, et « page 2 / 2 » lui
  // dit qu'il les a toutes. « Page 14 / 31 » ne lui dirait rien.
  const derniere = doc.getNumberOfPages();
  const total = derniere - premierePage + 1;
  for (let p = premierePage; p <= derniere; p++) {
    doc.setPage(p);
    police(doc, "corps", 7.5);
    doc.setTextColor(...COULEURS.muet);
    doc.text(
      `${r.stagiaire} — ${r.titre} — résultat publié le ${r.datePublication}`,
      X,
      289,
      { maxWidth: LARGEUR - 30 },
    );
    doc.text(`Page ${p - premierePage + 1} / ${total}`, X + LARGEUR, 289, {
      align: "right",
    });
  }
}

export async function construireResultatPdf(
  r: ResultatControle,
  marque?: Marque,
): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  await installerPolices(doc);
  dessinerResultat(doc, r, marque);
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
