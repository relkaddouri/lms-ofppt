/**
 * Le cahier du formateur, au format Word.
 *
 * La plateforme sortait déjà un « classeur pédagogique » : les fiches de
 * préparation reliées, avec une page de garde. Ce n'est pas ce que la Direction
 * attend. Le cahier du formateur est un document officiel de l'OFPPT, avec sa
 * couverture, sa fiche d'identité, ses procédures et ses tableaux de suivi — et
 * le formateur le recopiait chaque année dans Word.
 *
 * Il sort en `.docx` et non en PDF pour une raison précise : le cahier se
 * complète à la main en cours d'année, et il porte des émargements. Un PDF
 * fermerait le document le jour de son édition.
 *
 * Tout est assemblé dans le navigateur : aucune exécution serveur, donc aucun
 * coût d'hébergement, et les 180 Ko de polices embarquées ne traversent pas le
 * réseau deux fois.
 */

import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  ImageRun,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  convertMillimetersToTwip,
  type ISectionOptions,
} from "docx";
import {
  BORDURES_SANS,
  BORDURES_TABLEAU,
  COULEURS,
  PAGE_COUCHEE,
  PAGE_DEBOUT,
  PLEINE_LARGEUR,
  POLICES,
  SANS_FILETS,
  TAILLES,
  cellule,
  chargerPolices,
  tableau,
  colonnes,
  etiquetteValeur,
  panneau,
  pastilles,
  sousTitrePanneau,
  surTitre,
  titre1,
  titrePanneau,
  UTILE_DEBOUT,
} from "@/lib/docx-charte";
import { PROCEDURES } from "@/lib/docx-cahier-textes";
import { partieI } from "@/lib/docx-cahier-partie1";
import { partieII } from "@/lib/docx-cahier-partie2";
import { annexesModeles, annexesTextes } from "@/lib/docx-cahier-annexes";
import { rendreBlocs } from "@/lib/docx-blocs";
import type { CahierDonnees } from "@/app/actions/cahier";
import type { Etablissement } from "@/app/actions/etablissement";

// ── La couverture ─────────────────────────────────────────────────────────

/*
  La page de garde du dossier d'épreuve se lit à un mètre, debout devant une
  armoire : un bandeau de centre, un aplat d'encre qui annonce la pièce, puis les
  renseignements rangés en étiquettes et valeurs. Le cahier du formateur part au
  même endroit, et il doit se reconnaître de la même façon.

  Ce qui change : le cahier reste un document de l'OFPPT, et sa couverture porte
  « Royaume du Maroc » et le nom de l'Office. Ces deux lignes gardent leur place,
  dans le bandeau, au-dessus du panneau.
*/

/**
 * Mesure une image pour lui donner sa place sans la déformer.
 *
 * Word veut des dimensions explicites : il n'a pas de « largeur maximale ». Le
 * logo est déposé par le formateur, donc de proportions inconnues — on les lit
 * avant de le poser.
 */
async function mesurerLogo(
  dataUrl: string,
  largeurMax: number,
): Promise<{ width: number; height: number }> {
  const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error("Logo illisible"));
    img.src = dataUrl;
  });
  const echelle = Math.min(1, largeurMax / dims.w);
  return {
    width: Math.round(dims.w * echelle),
    height: Math.round(dims.h * echelle),
  };
}

/** Les octets et le format d'un logo donné en data URL. */
function decoderLogo(dataUrl: string): { octets: Uint8Array; type: "png" | "jpg" } {
  const virgule = dataUrl.indexOf(",");
  if (virgule < 0) throw new Error("Logo illisible");
  const binaire = atob(dataUrl.slice(virgule + 1));
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);
  return {
    octets,
    type: dataUrl.startsWith("data:image/png") ? "png" : "jpg",
  };
}

/** Une ligne de texte, dans la police et la couleur demandées. */
function ligne(
  texte: string,
  options: {
    taille?: number;
    couleur?: string;
    aDroite?: boolean;
    police?: string;
    apres?: number;
  } = {},
): Paragraph {
  return new Paragraph({
    alignment: options.aDroite ? AlignmentType.RIGHT : AlignmentType.LEFT,
    spacing: { after: options.apres ?? 100 },
    children: [
      new TextRun({
        text: texte,
        font: options.police ?? POLICES.titre,
        size: options.taille ?? TAILLES.corps,
        color: options.couleur ?? COULEURS.encre,
      }),
    ],
  });
}

/** Une cellule de mise en page : sans filets, et sans creux superflu. */
function caseNue(contenu: Paragraph[], haut = 0): TableCell {
  return new TableCell({
    borders: BORDURES_SANS,
    margins: {
      top: convertMillimetersToTwip(haut),
      bottom: 0,
      left: 0,
      right: 0,
    },
    children: contenu.length > 0 ? contenu : [new Paragraph({ children: [] })],
  });
}

/** Le logo de l'OFPPT, livré avec l'application. */
async function logoOfppt(largeur: number): Promise<Paragraph[]> {
  try {
    const rep = await fetch("/marque/ofppt.png");
    if (!rep.ok) throw new Error("logo introuvable");
    const octets = new Uint8Array(await rep.arrayBuffer());
    // Ses proportions sont connues : il est livré avec l'application.
    const hauteur = Math.round((largeur * 145) / 512);
    return [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new ImageRun({
            data: octets,
            transformation: { width: largeur, height: hauteur },
            type: "png",
          }),
        ],
      }),
    ];
  } catch {
    // Hors ligne ou fichier absent : la couverture sort sans lui plutôt que
    // de ne pas sortir.
    return [];
  }
}

/** Le logo de l'établissement, déposé par le formateur dans Paramètres. */
async function logoEtablissement(e: Etablissement): Promise<Paragraph[]> {
  if (!e.logo) return [];
  try {
    const { octets, type } = decoderLogo(e.logo);
    const transformation = await mesurerLogo(e.logo, 190);
    return [
      new Paragraph({
        children: [new ImageRun({ data: octets, transformation, type })],
      }),
    ];
  } catch {
    // Un logo illisible n'empêche pas le cahier de sortir : le formateur le
    // collera lui-même, ce qui vaut mieux que pas de cahier du tout.
    return [];
  }
}

/**
 * Le bandeau du centre : l'établissement à gauche, l'OFPPT à droite.
 *
 * Les deux logos seuls. Le logo de l'OFPPT porte déjà le nom de l'Office en
 * arabe et en français ; « Royaume du Maroc » au-dessus n'ajoutait rien que la
 * couverture ne dise pas.
 *
 * Un tableau sans filets sert de gouttière — Word n'a pas d'autre moyen de poser
 * deux choses côte à côte sans qu'elles se poussent.
 */
async function bandeau(e: Etablissement): Promise<(Paragraph | Table)[]> {
  const [gauche, droite] = await Promise.all([
    logoEtablissement(e),
    logoOfppt(260),
  ]);

  return [
    tableau({
      width: PLEINE_LARGEUR,
      borders: SANS_FILETS,
      columnWidths: colonnes(UTILE_DEBOUT, [1, 1.2]),
      rows: [
        new TableRow({
          children: [caseNue(gauche), caseNue(droite)],
        }),
      ],
    }),
  ];
}

/** Les quatre renseignements de la couverture, rangés en deux colonnes. */
function renseignements(e: Etablissement): Table {
  return tableau({
    width: PLEINE_LARGEUR,
    borders: SANS_FILETS,
    columnWidths: colonnes(UTILE_DEBOUT, [1, 1]),
    rows: [
      new TableRow({
        children: [
          etiquetteValeur("Direction régionale", e.directionRegionale ?? ""),
          etiquetteValeur("Année de formation", e.anneeScolaire ?? ""),
        ],
      }),
      new TableRow({
        children: [
          etiquetteValeur("Établissement", e.nom ?? ""),
          etiquetteValeur("Formateur", e.nomFormateur ?? ""),
        ],
      }),
    ],
  });
}

/**
 * Le cadre de signature, en bas de la couverture.
 *
 * Celle du formateur seule : c'est lui qui remet le cahier. Rien n'est prévu
 * pour un visa de la Direction, qui n'a pas été demandé — un cadre vide sur un
 * document officiel finit toujours par être rempli de travers.
 */
function signature(e: Etablissement): Table {
  const qui = [e.nomFormateur, e.matricule ? `mat. ${e.matricule}` : null]
    .filter(Boolean)
    .join(" · ");

  return tableau({
    width: PLEINE_LARGEUR,
    borders: SANS_FILETS,
    columnWidths: colonnes(UTILE_DEBOUT, [1.2, 1]),
    rows: [
      new TableRow({
        children: [
          caseNue([]),
          new TableCell({
            borders: {
              ...BORDURES_SANS,
              top: {
                style: BorderStyle.SINGLE,
                size: 4,
                color: COULEURS.bordureForte,
              },
            },
            margins: {
              top: convertMillimetersToTwip(2),
              bottom: 0,
              left: 0,
              right: 0,
            },
            children: [
              surTitre("Le formateur"),
              ligne(qui || "—", {
                police: POLICES.corps,
                couleur: COULEURS.corps,
                apres: 0,
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

async function couverture(e: Etablissement): Promise<(Paragraph | Table)[]> {
  return [
    ...(await bandeau(e)),
    new Paragraph({ spacing: { after: 700 }, children: [] }),
    /*
      Le seul aplat de la page. C'est ce qui la fait reconnaître de loin dans une
      pile de chemises, et en poser un second lui retirerait ce rôle.
    */
    panneau(UTILE_DEBOUT, [
      pastilles(),
      new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: "DOCUMENT OFFICIEL",
            font: POLICES.mono,
            size: TAILLES.petit,
            characterSpacing: 24,
            color: COULEURS.bordureForte,
          }),
        ],
      }),
      titrePanneau("Cahier du formateur"),
      sousTitrePanneau("Partenaire en compétences"),
    ]),
    new Paragraph({ spacing: { after: 640 }, children: [] }),
    renseignements(e),
    /*
      Le creux qui pousse la signature en bas de page. Word ne sait pas caler un
      bloc sur le bas d'une page : il faut lui mesurer l'espace. En vingtièmes
      de point, à peu près cent dix millimètres — ce qui reste sous les
      renseignements sur une A4.
    */
    new Paragraph({ spacing: { after: 6200 }, children: [] }),
    signature(e),
  ];
}

// ── La fiche d'identité ───────────────────────────────────────────────────

/** Une date de la base, telle que le cahier l'écrit : JJ/MM/AAAA. */
function enDateCourte(iso: string | null): string {
  if (!iso) return "-";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/**
 * Les dix lignes de la fiche d'identité.
 *
 * Une ligne non renseignée porte un tiret et non un blanc : le cahier officiel
 * fait ainsi pour la date du dernier bilan, et un blanc laisse croire à un
 * oubli d'impression.
 */
function ficheIdentite(e: Etablissement): Table {
  const lignes: [string, string][] = [
    ["Nom et Prénom", e.nomFormateur ?? "-"],
    ["Matricule", e.matricule ?? "-"],
    ["Date de recrutement", enDateCourte(e.dateRecrutement)],
    ["Grade", e.grade ?? "-"],
    ["Echelon", e.echelon ?? "-"],
    ["Diplôme", e.diplome ?? "-"],
    ["Spécialité d'origine", e.specialiteOrigine ?? "-"],
    ["Spécialité d'affectation", e.specialiteAffectation ?? "-"],
    ["Date d'affectation", enDateCourte(e.dateAffectation)],
    ["Date du dernier bilan de compétence", enDateCourte(e.dateDernierBilan)],
  ];

  return tableau({
    width: PLEINE_LARGEUR,
    borders: BORDURES_TABLEAU,
    columnWidths: colonnes(UTILE_DEBOUT, [4, 6]),
    rows: lignes.map(
      ([libelle, valeur], i) =>
        new TableRow({
          children: [
            cellule(libelle, { gras: true, fond: COULEURS.lavis }),
            cellule(valeur, { alterne: i % 2 === 1 }),
          ],
        }),
    ),
  });
}

// ── L'assemblage ──────────────────────────────────────────────────────────

/** Le pied de page : le numéro, et de quoi savoir d'où sort le document. */
function piedDePage(e: Etablissement): Footer {
  const mention = [e.nomFormateur, e.anneeScolaire].filter(Boolean).join(" — ");
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: mention ? `${mention} · ` : "",
            font: POLICES.corps,
            size: TAILLES.petit,
            color: COULEURS.muet,
          }),
          new TextRun({
            children: [PageNumber.CURRENT],
            font: POLICES.corps,
            size: TAILLES.petit,
            color: COULEURS.muet,
          }),
        ],
      }),
    ],
  });
}

/**
 * La page qui annonce une partie.
 *
 * Même aplat que la couverture, en plus bas sur la page : le cahier relié se
 * feuillette, et ces pages sont les onglets qu'on cherche du pouce.
 */
function pageSeparatrice(texte: string, rang: string): (Paragraph | Table)[] {
  return [
    new Paragraph({ spacing: { after: 2600 }, children: [] }),
    panneau(UTILE_DEBOUT, [
      pastilles(),
      new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: rang,
            font: POLICES.mono,
            size: TAILLES.petit,
            characterSpacing: 24,
            color: COULEURS.bordureForte,
          }),
        ],
      }),
      titrePanneau(texte, TAILLES.titreDocument),
    ]),
  ];
}

/**
 * Le titre d'une page intérieure.
 *
 * Pas d'aplat ici : le panneau est réservé aux pages qui annoncent. Un sur-titre
 * et un filet suffisent à poser le début d'une page.
 */
function titrePage(sur: string, texte: string): Paragraph[] {
  return [
    surTitre(sur, { couleur: COULEURS.sarcelle }),
    new Paragraph({
      spacing: { after: 300 },
      border: {
        bottom: {
          style: BorderStyle.SINGLE,
          size: 12,
          color: COULEURS.encre,
          space: 6,
        },
      },
      children: [
        new TextRun({
          text: texte,
          font: POLICES.titre,
          size: TAILLES.titreDocument,
          color: COULEURS.encre,
        }),
      ],
    }),
  ];
}

/**
 * Produit le cahier et le rend prêt à être téléchargé.
 *
 * Rend un `Blob` plutôt que de déclencher le téléchargement : c'est à l'écran
 * de décider quoi faire du fichier, et une fonction qui rend une valeur se
 * teste.
 */
export async function cahierDuFormateur(
  e: Etablissement,
  data: CahierDonnees,
  /*
    Le jour de l'édition. Il décide dans quelle colonne de mois tombe
    l'effectif ; passé en argument plutôt que lu de l'horloge, pour que le
    document soit reproductible et que le contrôle puisse l'épingler.
  */
  aujourdhui = new Date(),
): Promise<Blob> {
  const pied = piedDePage(e);

  /*
    Deux sections, parce que deux orientations. Les textes se lisent sur une
    page debout ; les tableaux de suivi font neuf à quatorze colonnes et ne
    tiennent que couchés.
  */
  const liminaires: ISectionOptions = {
    properties: { page: PAGE_DEBOUT },
    footers: { default: pied },
    children: [
      ...(await couverture(e)),
      new Paragraph({ children: [new PageBreak()] }),
      ...titrePage("Fiche d'identité", "Cahier du formateur"),
      ficheIdentite(e),
      new Paragraph({ children: [new PageBreak()] }),
      ...titrePage("Mode d'emploi", "Procédures d'utilisation"),
      ...rendreBlocs(PROCEDURES),
      new Paragraph({ children: [new PageBreak()] }),
      ...pageSeparatrice("Planification et suivi de la formation", "Première partie"),
    ],
  };

  const premierePartie: ISectionOptions = {
    properties: { page: PAGE_COUCHEE },
    footers: { default: pied },
    children: [
      titre1("I- Planification et suivi de la formation"),
      ...partieI(data.partieI, e.anneeScolaire, aujourdhui),
    ],
  };

  /*
    La page qui annonce la partie II revient debout : c'est une page de titre, et
    elle se lit comme la première. Les tableaux qui suivent repassent couchés.
  */
  const annonceII: ISectionOptions = {
    properties: { page: PAGE_DEBOUT },
    footers: { default: pied },
    children: pageSeparatrice(
      "Planification et suivi des évaluations",
      "Deuxième partie",
    ),
  };

  const secondePartie: ISectionOptions = {
    properties: { page: PAGE_COUCHEE },
    footers: { default: pied },
    children: [
      titre1("II- Planification et suivi des évaluations"),
      ...partieII(data.partieII),
    ],
  };

  /*
    Les annexes : les deux textes debout, les deux formulaires vierges couchés.
    Le cahier officiel les porte pour que le formateur ait ses modèles sous la
    main, et la plateforme n'a rien à y remplir.
  */
  const annonceAnnexes: ISectionOptions = {
    properties: { page: PAGE_DEBOUT },
    footers: { default: pied },
    children: [
      ...pageSeparatrice("Annexes", "Modèles et références"),
      new Paragraph({ children: [new PageBreak()] }),
      ...annexesTextes(),
    ],
  };

  const modeles: ISectionOptions = {
    properties: { page: PAGE_COUCHEE },
    footers: { default: pied },
    children: annexesModeles(),
  };

  const doc = new Document({
    creator: e.nomFormateur ?? "Pédago",
    title: "Cahier du formateur",
    description: `Cahier du formateur — ${e.anneeScolaire ?? ""}`.trim(),
    fonts: await chargerPolices(),
    sections: [
      liminaires,
      premierePartie,
      annonceII,
      secondePartie,
      annonceAnnexes,
      modeles,
    ],
  });

  return Packer.toBlob(doc);
}

/** Le nom du fichier téléchargé : lisible, et classable par année. */
export function nomFichierCahier(e: Etablissement): string {
  const annee = (e.anneeScolaire ?? "").replace("/", "-");
  const qui = (e.nomFormateur ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return ["Cahier-du-formateur", qui, annee].filter(Boolean).join("-") + ".docx";
}
