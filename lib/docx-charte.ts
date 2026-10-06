/**
 * Identité visuelle des documents Word produits par Pédago.
 *
 * Même rôle que `pdf-theme.ts` pour les PDF, et même palette : un cahier du
 * formateur sorti d'ici doit se reconnaître à côté d'un dossier de contrôle.
 * Les deux fichiers restent séparés parce que les unités n'ont rien à voir —
 * jsPDF compte en millimètres et en triplets RVB, Word en vingtièmes de point
 * et en hexadécimal sans dièse — et qu'une couche de conversion entre les deux
 * coûterait plus cher à lire qu'à dupliquer une liste de couleurs.
 *
 * Le document est assemblé dans le navigateur : aucune exécution serveur, donc
 * aucun coût Vercel, et le fichier descend directement dans les
 * téléchargements.
 */

import {
  AlignmentType,
  BorderStyle,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  convertMillimetersToTwip,
  type IBorderOptions,
  type ISectionPropertiesOptions,
  type ITableOptions,
} from "docx";

// ── Palette ───────────────────────────────────────────────────────────────

/*
  Les mêmes couleurs que les PDF (design_system.md §1), déjà assombries pour
  l'impression : le cahier part à la Direction sur papier, et un gris qui passe
  à l'écran se délave au tirage laser.

  Word les veut en hexadécimal sans dièse.
*/
export const COULEURS = {
  /** Bleu-ardoise : titres, en-têtes de tableau, filets structurants. */
  encre: "2E3B4E",
  encreFoncee: "25303F",
  /** Texte courant. L'encre reste aux titres. */
  corps: "3F4E62",
  ardoise: "5B6A7C",
  muet: "687584",
  sarcelle: "226A89",
  /*
    Les deux autres couleurs de la marque. Elles ne portent pas d'information
    dans un cahier — elles ne paraissent qu'en pastilles, qui signent le
    document comme la page de garde du dossier.
  */
  vert: "368050",
  corail: "D04438",
  blanc: "FFFFFF",
  papier: "F6F7F9",
  lavis: "EFF2F5",
  bordure: "E3E7EC",
  bordureForte: "C9D2DC",
} as const;

// ── Polices ───────────────────────────────────────────────────────────────

/**
 * Les rôles typographiques, nommés par ce qu'ils font.
 *
 * Les familles sont celles des TTF de `public/polices` : ce sont les noms que
 * Word lira dans le document.
 */
export const POLICES = {
  /** Sora en 600 : les titres sont déjà gras par la fonte, pas par Word. */
  titre: "Sora",
  corps: "SourceSans3",
  /*
    La graisse du texte courant porte son propre nom de famille.

    Deux fichiers sous un même nom donnaient deux `<w:font w:name="SourceSans3">`
    dans la table des polices, chacun se déclarant « régulier » : Word n'a aucun
    moyen de savoir lequel est la graisse, et retient le dernier. Le texte
    courant sortait alors en semi-gras.

    Nommée à part, chaque fonte est embarquée une fois et sans ambiguïté — même
    découpage que `pdf-theme.ts`, qui distingue déjà `corps` et `corpsGras`.
  */
  corpsGras: "SourceSans3 SemiBold",
  mono: "PlexMono",
} as const;

/** Les quatre fichiers à embarquer, et la famille que chacun sert. */
const FACES = [
  { fichier: "sora-600", famille: POLICES.titre },
  { fichier: "source-400", famille: POLICES.corps },
  { fichier: "source-600", famille: POLICES.corpsGras },
  { fichier: "mono-400", famille: POLICES.mono },
] as const;

/*
  Le typage de `docx` annonce un `Buffer` de Node pour les octets d'une police.
  À l'exécution il n'en lit que la longueur et le contenu, et un `Uint8Array`
  suffit — vérifié : le paquet produit porte bien `word/fonts/font1.odttf` et
  son `w:embedRegular`. C'est ce qui permet d'embarquer les polices depuis le
  navigateur, où `Buffer` n'existe pas, sans ajouter de polyfill.

  La conversion est écrite ici une fois, et nulle part ailleurs.
*/
type PoliceEmbarquee = { name: string; data: Buffer };

const enOctetsDocx = (o: Uint8Array) => o as unknown as Buffer;

/**
 * Les fontes une fois lues, gardées d'un document à l'autre.
 *
 * Le temps de l'onglet : le navigateur garde les fichiers eux-mêmes au-delà.
 */
let cache: PoliceEmbarquee[] | null = null;
let enCours: Promise<PoliceEmbarquee[]> | null = null;

/**
 * Lit les fontes du design system pour les embarquer dans le document.
 *
 * Sans elles, Word remplace Sora par ce qu'il a sous la main et le document ne
 * ressemble plus à rien : on les embarque donc, ce qui ajoute environ 180 Ko
 * par cahier. C'est le prix d'un document qui s'imprime pareil chez le
 * formateur et à la Direction.
 *
 * Si la lecture échoue — hors ligne, fichier absent — on rend une liste vide
 * plutôt que de ne rien produire : un cahier dans la police par défaut de Word
 * vaut mieux qu'un bouton qui ne fait rien.
 */
export async function chargerPolices(): Promise<PoliceEmbarquee[]> {
  if (cache) return cache;
  if (enCours) return enCours;

  enCours = (async () => {
    try {
      const lues = await Promise.all(
        FACES.map(async (f) => {
          const rep = await fetch(`/polices/${f.fichier}.ttf`);
          if (!rep.ok) throw new Error(`Police ${f.fichier} introuvable`);
          return {
            name: f.famille,
            data: enOctetsDocx(new Uint8Array(await rep.arrayBuffer())),
          };
        }),
      );
      cache = lues;
      return lues;
    } catch {
      // Pas de mise en cache d'un échec : la tentative suivante peut réussir.
      enCours = null;
      return [];
    }
  })();

  return enCours;
}

// ── Géométrie des pages ───────────────────────────────────────────────────

/*
  Les marges du document officiel, à l'identique : 12 mm partout. Le cahier est
  fait de tableaux larges, et les 25 mm habituels d'un courrier leur
  retireraient deux colonnes.
*/
const MARGE_MM = 12;

const marges = {
  top: convertMillimetersToTwip(MARGE_MM),
  right: convertMillimetersToTwip(MARGE_MM),
  bottom: convertMillimetersToTwip(MARGE_MM),
  left: convertMillimetersToTwip(MARGE_MM),
};

/*
  Les dimensions A4 que Word écrit lui-même, en vingtièmes de point.
  `convertMillimetersToTwip(210)` rend 11905 : l'écart avec 11906 ne se voit pas
  à l'impression, mais le cahier doit se superposer à l'original, et une
  constante nommée se relit mieux qu'un arrondi.
*/
const A4_COURT = 11906;
const A4_LONG = 16838;

/** A4 debout : la couverture, les procédures, les textes. */
export const PAGE_DEBOUT: ISectionPropertiesOptions["page"] = {
  size: { width: A4_COURT, height: A4_LONG },
  margin: marges,
};

/*
  A4 couché : les tableaux de suivi, trop larges pour la page debout.

  Les dimensions restent celles du portrait. `docx` échange lui-même largeur et
  hauteur quand l'orientation est « landscape » : les lui donner déjà échangées
  les remettait à l'endroit, et les sections sortaient avec le drapeau paysage
  mais la page debout. Les tableaux de quatorze colonnes étaient alors tassés
  dans 186 mm au lieu de 273, et débordaient.
*/
export const PAGE_COUCHEE: ISectionPropertiesOptions["page"] = {
  size: { width: A4_COURT, height: A4_LONG, orientation: "landscape" },
  margin: marges,
};

/** Largeur utile d'une page debout, en twips — pour répartir les colonnes. */
export const UTILE_DEBOUT = A4_COURT - 2 * marges.left;

/** Largeur utile d'une page couchée, en twips. */
export const UTILE_COUCHEE = A4_LONG - 2 * marges.left;

// ── Texte ─────────────────────────────────────────────────────────────────

/*
  Word compte les tailles en demi-points : 22 fait 11 points. On nomme les
  tailles plutôt que de semer des nombres, et les corps suivent l'échelle des
  PDF.
*/
export const TAILLES = {
  couverture: 56,
  titreDocument: 40,
  titre1: 30,
  titre2: 26,
  titre3: 22,
  corps: 21,
  tableau: 18,
  petit: 16,
} as const;

/** Un titre de niveau un : « I- Planification et suivi de la formation ». */
export function titre1(texte: string): Paragraph {
  return new Paragraph({
    spacing: { before: 360, after: 160 },
    keepNext: true,
    children: [
      new TextRun({
        text: texte,
        font: POLICES.titre,
        size: TAILLES.titre1,
        color: COULEURS.encre,
      }),
    ],
  });
}

/** Un titre de niveau deux : « A- Prise en charge des groupes ». */
export function titre2(texte: string): Paragraph {
  return new Paragraph({
    spacing: { before: 280, after: 120 },
    keepNext: true,
    children: [
      new TextRun({
        text: texte,
        font: POLICES.titre,
        size: TAILLES.titre2,
        color: COULEURS.encre,
      }),
    ],
  });
}

/** Un titre de tableau ou de rubrique, posé juste au-dessus de ce qu'il nomme. */
export function titre3(texte: string): Paragraph {
  return new Paragraph({
    spacing: { before: 240, after: 100 },
    keepNext: true,
    children: [
      new TextRun({
        text: texte,
        font: POLICES.titre,
        size: TAILLES.titre3,
        color: COULEURS.sarcelle,
      }),
    ],
  });
}

/** Un paragraphe de texte courant, justifié comme le document officiel. */
export function paragraphe(
  texte: string,
  options: { gras?: boolean; italique?: boolean; centre?: boolean } = {},
): Paragraph {
  return new Paragraph({
    spacing: { after: 120, line: 276 },
    alignment: options.centre ? AlignmentType.CENTER : AlignmentType.BOTH,
    children: [
      new TextRun({
        text: texte,
        font: options.gras ? POLICES.corpsGras : POLICES.corps,
        size: TAILLES.corps,
        italics: options.italique,
        color: COULEURS.corps,
      }),
    ],
  });
}

/**
 * Un élément de liste à puce.
 *
 * La puce est écrite dans le texte plutôt que confiée à une numérotation Word :
 * le document officiel énumère ainsi, et une numérotation automatique se
 * renumérote toute seule dès qu'on recolle un paragraphe ailleurs — ce que le
 * formateur fera, puisque le `.docx` est là pour être retouché.
 */
export function puce(texte: string): Paragraph {
  return new Paragraph({
    spacing: { after: 60, line: 276 },
    indent: { left: convertMillimetersToTwip(6), hanging: convertMillimetersToTwip(4) },
    children: [
      new TextRun({
        text: `• ${texte}`,
        font: POLICES.corps,
        size: TAILLES.corps,
        color: COULEURS.corps,
      }),
    ],
  });
}

/** Une ligne d'émargement, comme le cahier officiel la porte sous ses tableaux. */
export function emargement(
  libelle = "Émargement du Directeur Pédagogique :",
): Paragraph {
  return new Paragraph({
    spacing: { before: 200, after: 320 },
    children: [
      new TextRun({
        text: `${libelle}      `,
        font: POLICES.corps,
        size: TAILLES.corps,
        color: COULEURS.ardoise,
      }),
    ],
  });
}

// ── Tableaux ──────────────────────────────────────────────────────────────

const filet = (couleur: string, taille = 4): IBorderOptions => ({
  style: BorderStyle.SINGLE,
  size: taille,
  color: couleur,
});

/** Les filets d'une cellule ordinaire. */
export const BORDURES_CELLULE = {
  top: filet(COULEURS.bordureForte),
  bottom: filet(COULEURS.bordureForte),
  left: filet(COULEURS.bordureForte),
  right: filet(COULEURS.bordureForte),
};

/** Les filets d'un tableau, repris tels quels par chacun. */
export const BORDURES_TABLEAU = BORDURES_CELLULE;

/** Le creux des cellules : assez pour que le texte ne touche pas le filet. */
export const MARGES_CELLULE = {
  top: convertMillimetersToTwip(1),
  bottom: convertMillimetersToTwip(1),
  left: convertMillimetersToTwip(1.6),
  right: convertMillimetersToTwip(1.6),
};

/** Une cellule d'en-tête : fond encre, texte blanc, centrée. */
export function celluleEntete(
  texte: string,
  options: { colonnes?: number; lignes?: number } = {},
): TableCell {
  return new TableCell({
    columnSpan: options.colonnes,
    rowSpan: options.lignes,
    shading: { type: ShadingType.CLEAR, fill: COULEURS.encre, color: "auto" },
    verticalAlign: VerticalAlign.CENTER,
    margins: MARGES_CELLULE,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 40, after: 40 },
        children: [
          new TextRun({
            text: texte,
            font: POLICES.titre,
            size: TAILLES.tableau,
            color: COULEURS.blanc,
          }),
        ],
      }),
    ],
  });
}

/** Une cellule de contenu. `alterne` pose le fond pâle des lignes paires. */
export function cellule(
  texte: string,
  options: {
    colonnes?: number;
    lignes?: number;
    centre?: boolean;
    gras?: boolean;
    alterne?: boolean;
    fond?: string;
    /** Pour une cellule à remplir à la main : donne sa hauteur de respiration. */
    vide?: boolean;
  } = {},
): TableCell {
  const fond = options.fond ?? (options.alterne ? COULEURS.papier : undefined);
  return new TableCell({
    columnSpan: options.colonnes,
    rowSpan: options.lignes,
    verticalAlign: VerticalAlign.CENTER,
    margins: MARGES_CELLULE,
    ...(fond
      ? { shading: { type: ShadingType.CLEAR, fill: fond, color: "auto" } }
      : {}),
    children: [
      new Paragraph({
        alignment: options.centre ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: { before: options.vide ? 80 : 20, after: options.vide ? 80 : 20 },
        children: [
          new TextRun({
            text: texte,
            font: options.gras ? POLICES.corpsGras : POLICES.corps,
            size: TAILLES.tableau,
            color: options.gras ? COULEURS.encre : COULEURS.corps,
          }),
        ],
      }),
    ],
  });
}

/** Répartit une largeur utile en colonnes proportionnelles. */
export function colonnes(utile: number, parts: number[]): number[] {
  const total = parts.reduce((s, p) => s + p, 0);
  return parts.map((p) => Math.round((utile * p) / total));
}

/** La largeur d'un tableau : toujours la page entière, jamais « au contenu ». */
export const PLEINE_LARGEUR = {
  size: 100,
  type: WidthType.PERCENTAGE,
} as const;

/**
 * Un tableau, dont les largeurs de colonnes sont celles qu'on a demandées.
 *
 * Word ajuste par défaut un tableau à son contenu : les `columnWidths` ne sont
 * alors qu'une suggestion, et une cellule courte rétrécit sa colonne. Le panneau
 * de la couverture n'occupait ainsi que la moitié de la page, et les tableaux de
 * quatorze colonnes se tassaient à gauche.
 *
 * `FIXED` rend aux largeurs calculées leur autorité. Tous les tableaux du cahier
 * passent par ici, pour qu'aucun ne l'oublie.
 */
export function tableau(options: ITableOptions): Table {
  return new Table({ layout: TableLayoutType.FIXED, ...options });
}

// ── Les blocs de composition, repris de la page de garde du dossier ───────

/*
  Le dossier d'épreuve a une page de garde qui se lit à un mètre, debout devant
  une armoire : un aplat d'encre, trois pastilles de couleur, un sur-titre en
  capitales étroites, puis le titre en blanc. Le cahier du formateur part au même
  endroit et doit se reconnaître de la même façon.

  Word ne sait pas dessiner : un aplat se fait avec un tableau d'une seule
  cellule, sans filets. C'est le seul détour, et il est écrit ici une fois.
*/

/** Les filets d'une cellule qui n'en a pas. */
export const BORDURES_SANS = {
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
} as const;

/** Un tableau sans aucun filet : il ne sert qu'à poser un fond ou une grille. */
export const SANS_FILETS = {
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
} as const;

/**
 * Un sur-titre : petites capitales espacées, en monospace.
 *
 * Il nomme la nature du bloc sans lui voler l'attention — « DOCUMENT OFFICIEL »
 * au-dessus d'un titre, « FILIÈRE » au-dessus d'une valeur.
 */
export function surTitre(
  texte: string,
  options: { couleur?: string; centre?: boolean } = {},
): Paragraph {
  return new Paragraph({
    alignment: options.centre ? AlignmentType.CENTER : AlignmentType.LEFT,
    spacing: { after: 60 },
    children: [
      new TextRun({
        text: texte.toLocaleUpperCase("fr"),
        font: POLICES.mono,
        size: TAILLES.petit,
        // Un douzième de point entre les lettres : sans cet air, des capitales
        // de huit points se lisent comme un bloc.
        characterSpacing: 24,
        color: options.couleur ?? COULEURS.ardoise,
      }),
    ],
  });
}

/** Les trois pastilles de la marque, toujours dans cet ordre. */
export function pastilles(): Paragraph {
  return new Paragraph({
    spacing: { after: 160 },
    children: [COULEURS.vert, COULEURS.sarcelle, COULEURS.corail].map(
      (c) =>
        new TextRun({
          text: "●  ",
          font: POLICES.corps,
          size: TAILLES.corps,
          color: c,
        }),
    ),
  });
}

/**
 * L'aplat d'encre qui annonce un document ou une partie.
 *
 * Le seul aplat de la page : c'est ce qui la fait reconnaître de loin dans une
 * pile de chemises, et en mettre un second lui retirerait ce rôle.
 */
export function panneau(
  largeur: number,
  contenu: Paragraph[],
  options: { fond?: string } = {},
): Table {
  return tableau({
    width: PLEINE_LARGEUR,
    borders: SANS_FILETS,
    columnWidths: [largeur],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: {
              type: ShadingType.CLEAR,
              fill: options.fond ?? COULEURS.encre,
              color: "auto",
            },
            borders: BORDURES_SANS,
            margins: {
              top: convertMillimetersToTwip(9),
              bottom: convertMillimetersToTwip(9),
              left: convertMillimetersToTwip(9),
              right: convertMillimetersToTwip(9),
            },
            children: contenu,
          }),
        ],
      }),
    ],
  });
}

/** Le titre d'un panneau : en blanc sur l'encre, et rien d'autre à côté. */
export function titrePanneau(
  texte: string,
  taille: number = TAILLES.couverture,
): Paragraph {
  return new Paragraph({
    spacing: { after: 100 },
    children: [
      new TextRun({
        text: texte,
        font: POLICES.titre,
        size: taille,
        color: COULEURS.blanc,
      }),
    ],
  });
}

/** La ligne qui suit un titre de panneau : plus petite, plus pâle. */
export function sousTitrePanneau(texte: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: texte,
        font: POLICES.corps,
        size: TAILLES.titre3,
        color: COULEURS.bordureForte,
      }),
    ],
  });
}

/**
 * Une paire étiquette / valeur, comme la page de garde du dossier les range.
 *
 * L'étiquette en capitales étroites au-dessus, la valeur en dessous : on lit la
 * colonne des valeurs d'un trait, sans que les étiquettes s'y mêlent.
 */
export function etiquetteValeur(etiquette: string, valeur: string): TableCell {
  return new TableCell({
    borders: BORDURES_SANS,
    margins: {
      top: convertMillimetersToTwip(2),
      bottom: convertMillimetersToTwip(2),
      left: 0,
      right: convertMillimetersToTwip(4),
    },
    children: [
      surTitre(etiquette),
      new Paragraph({
        children: [
          new TextRun({
            text: valeur || "—",
            font: POLICES.corps,
            size: TAILLES.titre3,
            color: COULEURS.encre,
          }),
        ],
      }),
    ],
  });
}
