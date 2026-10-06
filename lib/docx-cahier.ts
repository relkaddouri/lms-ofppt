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
  Document,
  Footer,
  ImageRun,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  Table,
  TableRow,
  TextRun,
  type ISectionOptions,
} from "docx";
import {
  BORDURES_TABLEAU,
  COULEURS,
  PAGE_DEBOUT,
  PLEINE_LARGEUR,
  POLICES,
  TAILLES,
  cellule,
  chargerPolices,
  colonnes,
  paragraphe,
  puce,
  titre1,
  titre2,
  UTILE_DEBOUT,
} from "@/lib/docx-charte";
import { PROCEDURES } from "@/lib/docx-cahier-textes";
import type { Etablissement } from "@/app/actions/etablissement";

// ── La couverture ─────────────────────────────────────────────────────────

/** Une ligne centrée de la couverture, dans la police et le corps demandés. */
function ligneCouverture(
  texte: string,
  options: { taille?: number; couleur?: string; apres?: number } = {},
): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: options.apres ?? 160 },
    children: [
      new TextRun({
        text: texte,
        // Pas de `bold` : la fonte embarquée est déjà la 600, et Word
        // l'épaissirait une seconde fois par-dessus.
        font: POLICES.titre,
        size: options.taille ?? TAILLES.corps,
        color: options.couleur ?? COULEURS.encre,
      }),
    ],
  });
}

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

async function couverture(e: Etablissement): Promise<Paragraph[]> {
  const blocs: Paragraph[] = [
    new Paragraph({ spacing: { after: 600 }, children: [] }),
    ligneCouverture("Royaume du Maroc", { taille: TAILLES.titre3 }),
    ligneCouverture(
      "Office de la Formation Professionnelle et de la Promotion du Travail",
      { taille: TAILLES.titre3, couleur: COULEURS.ardoise, apres: 480 },
    ),
  ];

  // Un logo absent ou illisible ne doit pas empêcher le cahier de sortir :
  // le formateur le collera lui-même, ce qui est toujours mieux que rien.
  if (e.logo) {
    try {
      const { octets, type } = decoderLogo(e.logo);
      const transformation = await mesurerLogo(e.logo, 200);
      blocs.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 480 },
          children: [new ImageRun({ data: octets, transformation, type })],
        }),
      );
    } catch {
      blocs.push(new Paragraph({ spacing: { after: 480 }, children: [] }));
    }
  }

  blocs.push(
    ligneCouverture("CAHIER DU FORMATEUR", {
      taille: TAILLES.couverture,
      apres: 240,
    }),
    ligneCouverture("Partenaire en compétences", {
      taille: TAILLES.titre3,
      couleur: COULEURS.sarcelle,
      apres: 800,
    }),
    ligneCouverture(`Direction Régionale : ${e.directionRegionale ?? ""}`, {
      taille: TAILLES.titre3,
      couleur: COULEURS.corps,
    }),
    ligneCouverture(`Établissement : ${e.nom ?? ""}`, {
      taille: TAILLES.titre3,
      couleur: COULEURS.corps,
    }),
    ligneCouverture(`Année de formation : ${e.anneeScolaire ?? ""}`, {
      taille: TAILLES.titre3,
      couleur: COULEURS.corps,
    }),
  );

  return blocs;
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

  return new Table({
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

// ── Les procédures ────────────────────────────────────────────────────────

/** Le texte officiel, rendu selon le genre de chaque paragraphe. */
function procedures(): Paragraph[] {
  return PROCEDURES.map((b) => {
    if (b.genre === "titre1") return titre1(b.texte);
    if (b.genre === "titre2") return titre2(b.texte);
    if (b.genre === "puce") return puce(b.texte);
    return paragraphe(b.texte);
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

/** Un titre de page intérieure, celui que porte la fiche d'identité. */
function titrePage(texte: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 240, after: 360 },
    children: [
      new TextRun({
        text: texte,
        font: POLICES.titre,
        size: TAILLES.titreDocument,
        color: COULEURS.encre,
      }),
    ],
  });
}

/**
 * Produit le cahier et le rend prêt à être téléchargé.
 *
 * Rend un `Blob` plutôt que de déclencher le téléchargement : c'est à l'écran
 * de décider quoi faire du fichier, et une fonction qui rend une valeur se
 * teste.
 */
export async function cahierDuFormateur(e: Etablissement): Promise<Blob> {
  const section: ISectionOptions = {
    properties: { page: PAGE_DEBOUT },
    footers: { default: piedDePage(e) },
    children: [
      ...(await couverture(e)),
      new Paragraph({ children: [new PageBreak()] }),
      titrePage("CAHIER DU FORMATEUR"),
      ficheIdentite(e),
      new Paragraph({ children: [new PageBreak()] }),
      titrePage("Procédures d'utilisation du Cahier du formateur"),
      ...procedures(),
    ],
  };

  const doc = new Document({
    creator: e.nomFormateur ?? "Pédago",
    title: "Cahier du formateur",
    description: `Cahier du formateur — ${e.anneeScolaire ?? ""}`.trim(),
    fonts: await chargerPolices(),
    sections: [section],
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
