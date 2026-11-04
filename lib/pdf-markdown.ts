import type jsPDF from "jspdf";
import {
  COULEURS,
  HORS_SORA,
  imprimable,
  police,
  type RolePolice,
} from "@/lib/pdf-theme";
import { segmenter, type Segment } from "@/lib/markdown";
import { analyser, decrire } from "@/lib/schema-reponse";

/**
 * Dessine du markdown dans un PDF avec la typographie du produit (PRD §4.4).
 *
 * Pendant du rendu écran de `components/TexteMarkdown` : « la source de la
 * rédaction ne doit jamais se voir dans le résultat ». Une section écrite à la
 * main doit sortir de l'imprimante comme une section générée — mêmes polices,
 * mêmes gris, mêmes retraits.
 *
 * Ce que ce moteur couvre : titres, paragraphes, listes à puces, numérotées,
 * imbriquées et à cocher, encadrés (citations, qui peuvent contenir listes et
 * tableaux), filets, code, tableaux, schémas, et le gras, l'italique et le
 * code en ligne. Les images et les vidéos intégrées s'impriment en une ligne
 * qui dit ce qu'elles sont et où les trouver : c'est la seule forme utilisable
 * sur papier.
 *
 * Le moteur lit d'abord le texte en blocs, puis les dessine. L'ancien
 * dessinait ligne à ligne, et cela se voyait : un encadré de cinq lignes
 * sortait en cinq citations, une liste dans un encadré gardait ses tirets, un
 * tableau dans un encadré imprimait ses barres verticales — sur un cours réel
 * de 109 pages, 23 tableaux et 54 listes étaient dans ce cas.
 */

export type CadreMarkdown = {
  /** Abscisse du bord gauche du texte. */
  x: number;
  largeur: number;
  /** Ordonnée de la première ligne. */
  y: number;
  /** Appelée avant d'écrire : doit réserver la hauteur et rendre l'ordonnée. */
  place: (hauteur: number) => number;
  /**
   * La hauteur encore libre sur la page. Facultative : sans elle, le moteur
   * ne sait pas garder un titre avec ce qui le suit, et ne le fait pas.
   */
  reste?: () => number;
  /** Passe à la page suivante et rend l'ordonnée de départ. */
  saut?: () => number;
};

type Rvb = readonly [number, number, number];

// ── Lecture en blocs ────────────────────────────────────────────────────────

type Element = {
  niveau: number;
  /** « • » ou « 1. ». */
  marque: string;
  ordonne: boolean;
  /** null hors des listes à cocher. */
  coche: boolean | null;
  texte: string;
};

type Alignement = "gauche" | "centre" | "droite";

type Bloc =
  | { genre: "titre"; niveau: number; texte: string }
  | { genre: "paragraphe"; lignes: string[] }
  | { genre: "liste"; elements: Element[] }
  | { genre: "encadre"; enfants: Bloc[] }
  | {
      genre: "tableau";
      entetes: string[];
      rangees: string[][];
      alignements: Alignement[];
    }
  | { genre: "code"; lignes: string[] }
  | { genre: "schema"; corps: string }
  | { genre: "filet" }
  | { genre: "media"; texte: string };

const FILET = /^(?:-{3,}|\*{3,}|_{3,})$/;
const TITRE = /^(#{1,6})\s+(.*?)\s*#*$/;
const ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const SEPARATEUR = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/;

function estTableau(ligne: string, suivante: string | undefined): boolean {
  return (
    ligne.trim().startsWith("|") && SEPARATEUR.test((suivante ?? "").trim())
  );
}

/** Une ligne qui ouvre un autre bloc arrête le paragraphe en cours. */
function ouvreUnBloc(ligne: string, suivante: string | undefined): boolean {
  const nue = ligne.trim();
  return (
    !nue ||
    nue.startsWith(">") ||
    nue.startsWith("```") ||
    nue.startsWith("<") ||
    FILET.test(nue) ||
    TITRE.test(nue) ||
    ITEM.test(ligne) ||
    estTableau(ligne, suivante)
  );
}

function cellulesDe(ligne: string): string[] {
  // Une barre échappée — `\|` — fait partie du texte de la cellule.
  return ligne
    .trim()
    .replace(/^\|/, "")
    .replace(/(?<!\\)\|$/, "")
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replace(/\\\|/g, "|"));
}

/** Ce qu'une balise HTML veut dire sur papier, ou rien. */
function mediaDe(html: string): string | null {
  const src = html.match(/\bsrc=["']([^"']+)["']/i)?.[1];
  if (/^<iframe/i.test(html)) {
    const titre = html.match(/\btitle=["']([^"']+)["']/i)?.[1];
    const lien = src?.replace(
      /^https?:\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/embed\/([^?"']+).*$/,
      "https://youtu.be/$1",
    );
    const nom =
      titre && !/youtube video player/i.test(titre) ? ` « ${titre} »` : "";
    return `▶ Vidéo${nom} : ${lien ?? "en ligne"}`;
  }
  if (/^<img/i.test(html)) {
    const alt = html.match(/\balt=["']([^"']*)["']/i)?.[1];
    return `Image${alt ? ` « ${alt} »` : ""}${src && !src.startsWith("data:") ? ` : ${src}` : ""}`;
  }
  return null;
}

/** Échappe le balisage d'un texte qui doit s'imprimer tel quel. */
function litteral(texte: string): string {
  return texte.replace(/([*_`\\])/g, "\\$1");
}

function lireBlocs(markdown: string): Bloc[] {
  const lignes = markdown
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, "    ")
    .split("\n");
  const blocs: Bloc[] = [];

  for (let i = 0; i < lignes.length; i++) {
    const ligne = lignes[i]!;
    const nue = ligne.trim();
    if (!nue) continue;

    // ── Code et schéma ──
    if (nue.startsWith("```")) {
      const langage = nue.slice(3).trim();
      const corps: string[] = [];
      i += 1;
      while (i < lignes.length && !lignes[i]!.trim().startsWith("```")) {
        corps.push(lignes[i]!);
        i += 1;
      }
      blocs.push(
        langage === "schema"
          ? { genre: "schema", corps: corps.join("\n") }
          : { genre: "code", lignes: corps },
      );
      continue;
    }

    if (FILET.test(nue)) {
      blocs.push({ genre: "filet" });
      continue;
    }

    const titre = nue.match(TITRE);
    if (titre) {
      blocs.push({
        genre: "titre",
        niveau: titre[1]!.length,
        texte: titre[2]!,
      });
      continue;
    }

    // ── Encadré ──
    //
    // Les lignes `>` consécutives forment UN bloc, dont le contenu se lit
    // comme du markdown à part entière. Deux encadrés séparés par une ligne
    // vide restent deux encadrés : c'est ainsi que les cours alignent leurs
    // « OBJECTIF 1 », « OBJECTIF 2 »…
    if (nue.startsWith(">")) {
      const contenu: string[] = [];
      while (i < lignes.length && lignes[i]!.trim().startsWith(">")) {
        // trimStart et non trim : les deux espaces de fin forcent un retour à
        // la ligne, et l'encadré « OBJECTIF » en dépend.
        contenu.push(lignes[i]!.trimStart().replace(/^>\s?/, ""));
        i += 1;
      }
      i -= 1;
      blocs.push({ genre: "encadre", enfants: lireBlocs(contenu.join("\n")) });
      continue;
    }

    // ── Tableau ──
    if (estTableau(ligne, lignes[i + 1])) {
      const entetes = cellulesDe(ligne);
      const alignements: Alignement[] = cellulesDe(lignes[i + 1]!).map((c) =>
        c.startsWith(":") && c.endsWith(":")
          ? "centre"
          : c.endsWith(":")
            ? "droite"
            : "gauche",
      );
      i += 2;
      const rangees: string[][] = [];
      while (i < lignes.length && lignes[i]!.trim().startsWith("|")) {
        rangees.push(cellulesDe(lignes[i]!));
        i += 1;
      }
      i -= 1;
      blocs.push({ genre: "tableau", entetes, rangees, alignements });
      continue;
    }

    // ── Liste ──
    //
    // Une ligne vide n'interrompt pas une liste si la suivante en reprend un
    // élément ; une ligne en retrait sans marque prolonge l'élément précédent.
    if (ITEM.test(ligne)) {
      const elements: Element[] = [];
      const retraits: number[] = [];
      while (i < lignes.length) {
        const l = lignes[i]!;
        const item = l.match(ITEM);
        if (item) {
          const retrait = item[1]!.length;
          while (
            retraits.length > 0 &&
            retrait < retraits[retraits.length - 1]!
          )
            retraits.pop();
          if (retraits.length === 0 || retrait > retraits[retraits.length - 1]!)
            retraits.push(retrait);
          const tache = item[3]!.match(/^\[([ xX])\]\s+(.*)$/);
          const ordonne = /\d/.test(item[2]!);
          elements.push({
            niveau: Math.min(retraits.length - 1, 3),
            marque: ordonne ? item[2]!.replace(")", ".") : "•",
            ordonne,
            coche: tache ? tache[1] !== " " : null,
            texte: tache ? tache[2]! : item[3]!,
          });
          i += 1;
          continue;
        }
        if (!l.trim()) {
          const suite = lignes.slice(i + 1).find((x) => x.trim());
          if (suite && ITEM.test(suite)) {
            i += 1;
            continue;
          }
          break;
        }
        if (/^\s{2,}/.test(l) && elements.length > 0) {
          elements[elements.length - 1]!.texte += ` ${l.trim()}`;
          i += 1;
          continue;
        }
        break;
      }
      i -= 1;
      blocs.push({ genre: "liste", elements });
      continue;
    }

    // ── HTML et images ──
    if (nue.startsWith("<")) {
      const media = mediaDe(nue);
      if (media) blocs.push({ genre: "media", texte: media });
      else {
        const texte = nue.replace(/<[^>]*>/g, "").trim();
        if (texte) blocs.push({ genre: "paragraphe", lignes: [texte] });
      }
      continue;
    }
    const image = nue.match(/^!\[([^\]]*)\]\(([^)\s]+)[^)]*\)$/);
    if (image) {
      const alt = image[1] ? ` « ${image[1]} »` : "";
      const url = image[2]!.startsWith("data:") ? "" : ` : ${image[2]}`;
      blocs.push({ genre: "media", texte: `Image${alt}${url}` });
      continue;
    }

    // ── Paragraphe ──
    //
    // Les lignes qui se suivent forment une seule phrase, comme à l'écran ;
    // deux espaces ou une barre oblique en fin de ligne forcent le retour.
    const rendu: string[] = [];
    let courante = "";
    while (i < lignes.length) {
      const l = lignes[i]!;
      if (courante && ouvreUnBloc(l, lignes[i + 1])) break;
      // Une fiche d'identité — « **Module** M202 », « **Filière** … » — garde
      // une ligne par rubrique, même écrite sans les deux espaces : collées
      // bout à bout, les rubriques ne se retrouvaient plus.
      const rubrique = /^\*\*[^*]+\*\*/;
      const force =
        / {2,}$/.test(l) ||
        /\\$/.test(l) ||
        (rubrique.test(l.trim()) &&
          rubrique.test((lignes[i + 1] ?? "").trim()));
      courante += (courante ? " " : "") + l.trim().replace(/\\$/, "");
      i += 1;
      if (force) {
        rendu.push(courante);
        courante = "";
        if (i < lignes.length && ouvreUnBloc(lignes[i]!, lignes[i + 1])) break;
      }
    }
    if (courante) rendu.push(courante);
    i -= 1;
    if (rendu.length > 0) blocs.push({ genre: "paragraphe", lignes: rendu });
  }

  return blocs;
}

// ── Mise en lignes ──────────────────────────────────────────────────────────

type Morceau = { texte: string; role: RolePolice; couleur: Rvb };
type Ligne = { morceaux: Morceau[]; largeur: number };

/**
 * Coupe du texte stylé en lignes, mot par mot, chaque mot mesuré dans sa
 * propre police.
 *
 * `splitTextToSize` coupe un texte nu dans une seule police : un mot en gras,
 * plus large, pouvait déborder de la colonne. Et les tableaux n'en passaient
 * même pas par là : chaque cellule s'imprimait avec ses astérisques — 572
 * cellules sur un seul cours.
 */
function couper(
  doc: jsPDF,
  segments: Segment[],
  largeur: number,
  taille: number,
  couleur: Rvb,
  base: RolePolice = "corps",
): Ligne[] {
  type Jeton = Morceau & { espace: boolean };
  const jetons: Jeton[] = [];
  for (const s of segments) {
    const role: RolePolice = s.code
      ? "mono"
      : s.gras && base === "corps"
        ? "corpsGras"
        : base;
    // Pas de face italique dans les fontes embarquées : l'italique se lit en
    // ardoise, comme à l'écran les mentions secondaires.
    const teinte: Rvb =
      s.code || (s.italique && base === "corps") ? COULEURS.ardoise : couleur;
    const texte = s.code ? s.texte : imprimable(s.texte);
    for (const brin of texte.split(/(\s+)/)) {
      if (!brin) continue;
      if (/^\s+$/.test(brin)) {
        jetons.push({ texte: " ", role, couleur: teinte, espace: true });
        continue;
      }
      // Sora n'a ni flèches ni symboles : ils passent dans la police du texte.
      if (role === "titre" && HORS_SORA.test(brin)) {
        for (const p of brin.split(new RegExp(`(${HORS_SORA.source}+)`))) {
          if (p) {
            const symbole = HORS_SORA.test(p);
            jetons.push({
              texte: p,
              role: symbole ? "corpsGras" : "titre",
              couleur: teinte,
              espace: false,
            });
          }
        }
        continue;
      }
      jetons.push({ texte: brin, role, couleur: teinte, espace: false });
    }
  }

  const mesure = (m: Morceau) => {
    police(doc, m.role, taille);
    return doc.getTextWidth(m.texte);
  };

  // Les jetons collés — « **gras**, » — forment un seul mot insécable.
  type Mot = {
    morceaux: Morceau[];
    largeur: number;
    espaceAvant: Morceau | null;
  };
  const mots: Mot[] = [];
  let espace: Morceau | null = null;
  let colle = false;
  for (const j of jetons) {
    if (j.espace) {
      espace = j;
      colle = false;
      continue;
    }
    const l = mesure(j);
    const dernier = mots[mots.length - 1];
    if (colle && dernier) {
      dernier.morceaux.push(j);
      dernier.largeur += l;
    } else {
      mots.push({
        morceaux: [j],
        largeur: l,
        espaceAvant: dernier ? espace : null,
      });
    }
    espace = null;
    colle = true;
  }

  const lignes: Ligne[] = [];
  let courante: Ligne = { morceaux: [], largeur: 0 };
  const pousser = () => {
    if (courante.morceaux.length > 0) lignes.push(courante);
    courante = { morceaux: [], largeur: 0 };
  };

  for (const mot of mots) {
    const lEspace =
      mot.espaceAvant && courante.morceaux.length > 0
        ? mesure(mot.espaceAvant)
        : 0;
    if (courante.largeur + lEspace + mot.largeur <= largeur + 0.01) {
      if (lEspace) courante.morceaux.push(mot.espaceAvant!);
      courante.morceaux.push(...mot.morceaux);
      courante.largeur += lEspace + mot.largeur;
      continue;
    }
    pousser();
    if (mot.largeur <= largeur) {
      courante.morceaux.push(...mot.morceaux);
      courante.largeur = mot.largeur;
      continue;
    }
    // Un mot plus large que la colonne — une URL — se coupe à la lettre.
    for (const m of mot.morceaux) {
      for (const c of m.texte) {
        const l = mesure({ ...m, texte: c });
        if (courante.largeur + l > largeur && courante.morceaux.length > 0)
          pousser();
        const dernier = courante.morceaux[courante.morceaux.length - 1];
        if (dernier && dernier.role === m.role && dernier.couleur === m.couleur)
          dernier.texte += c;
        else courante.morceaux.push({ ...m, texte: c });
        courante.largeur += l;
      }
    }
  }
  pousser();
  return lignes.length > 0 ? lignes : [{ morceaux: [], largeur: 0 }];
}

function peindre(
  doc: jsPDF,
  ligne: Ligne,
  x: number,
  y: number,
  taille: number,
) {
  let curseur = x;
  for (const m of ligne.morceaux) {
    police(doc, m.role, taille);
    doc.setTextColor(...m.couleur);
    doc.text(m.texte, curseur, y);
    curseur += doc.getTextWidth(m.texte);
  }
}

// ── Mesure ──────────────────────────────────────────────────────────────────

/**
 * Un document qui mesure sans peindre.
 *
 * Mesurer autrement — compter les lignes à la main — se paie toujours : le
 * fond coloré d'un bloc était tracé d'après une estimation, et le texte
 * débordait dessous dès que le moteur n'espaçait pas comme la formule le
 * supposait. Ici c'est le même code qui mesure et qui dessine, donc les deux
 * ne peuvent pas diverger.
 */
function muet(doc: jsPDF): jsPDF {
  const MUETS = new Set([
    "text",
    "rect",
    "line",
    "link",
    "setFillColor",
    "setDrawColor",
    "setLineWidth",
    "setTextColor",
  ]);
  const silencieux: jsPDF = new Proxy(doc, {
    get(cible, nom: string) {
      if (MUETS.has(nom)) return () => silencieux;
      const valeur = Reflect.get(cible, nom) as unknown;
      return typeof valeur === "function" ? valeur.bind(cible) : valeur;
    },
  });
  return silencieux;
}

function mesurerBlocs(doc: jsPDF, blocs: Bloc[], largeur: number): number {
  let y = 0;
  dessinerBlocs(
    muet(doc),
    blocs,
    {
      x: 0,
      largeur,
      y,
      place: (h) => {
        y += h;
        return y;
      },
    },
    0,
  );
  return y;
}

/**
 * La hauteur que `dessinerMarkdown` occupera, sans rien tracer.
 *
 * Les changements de page sont ignorés : un fond s'arrête au bas de la page de
 * toute façon, et c'est à l'appelant de décider s'il coupe.
 */
export function mesurerMarkdown(
  doc: jsPDF,
  markdown: string,
  largeur: number,
): number {
  return mesurerBlocs(doc, lireBlocs(markdown), largeur);
}

// ── Dessin ──────────────────────────────────────────────────────────────────

const TEXTE = { taille: 9.5, interligne: 4.7 };

type StyleTitre = {
  taille: number;
  interligne: number;
  avant: number;
  role: RolePolice;
  couleur: Rvb;
};

/**
 * Le corps des titres, du chapitre au sous-paragraphe.
 *
 * L'ancienne échelle — 12,5, 11 et 10 points pour un texte à 9,5 — ne
 * distinguait pas un titre de section d'un intertitre : sur une page de
 * cours, rien ne disait où commençait la partie 2.
 */
const TITRES: Record<number, StyleTitre> = {
  1: {
    taille: 15,
    interligne: 6.8,
    avant: 9,
    role: "titre",
    couleur: COULEURS.encre,
  },
  2: {
    taille: 12.5,
    interligne: 5.8,
    avant: 8,
    role: "titre",
    couleur: COULEURS.encre,
  },
  3: {
    taille: 10.8,
    interligne: 5.1,
    avant: 5.5,
    role: "titre",
    couleur: COULEURS.sarcelle,
  },
  4: {
    taille: 10,
    interligne: 4.8,
    avant: 4.5,
    role: "corpsGras",
    couleur: COULEURS.encre,
  },
};

/** Ce qu'un titre veut voir avec lui au bas d'une page, au minimum. */
const SUITE_MINIMALE = 16;

/**
 * Ce qu'un bloc emporte d'un seul tenant en haut d'une page : sa hauteur
 * entière pour un encadré court, l'en-tête et la première rangée pour un
 * tableau, deux lignes pour un texte.
 *
 * Mesurer moins que cela laissait passer le titre : il tenait avec 16 mm de
 * suite, puis l'encadré qui suivait, trop haut pour la fin de page, partait
 * en entier à la suivante — et le titre restait seul.
 */
function debutInsecable(doc: jsPDF, bloc: Bloc, largeur: number): number {
  if (
    bloc.genre === "encadre" ||
    bloc.genre === "code" ||
    bloc.genre === "schema"
  ) {
    const h = mesurerBlocs(doc, [bloc], largeur);
    return h <= 90 ? h : SUITE_MINIMALE;
  }
  if (bloc.genre === "tableau") {
    const debut = mesurerBlocs(
      doc,
      [{ ...bloc, rangees: bloc.rangees.slice(0, 1) }],
      largeur,
    );
    return debut <= 100 ? debut : SUITE_MINIMALE;
  }
  if (bloc.genre === "paragraphe" || bloc.genre === "liste") {
    return Math.min(
      mesurerBlocs(doc, [bloc], largeur),
      TEXTE.interligne * 2 + 1,
    );
  }
  return Math.min(mesurerBlocs(doc, [bloc], largeur), SUITE_MINIMALE);
}

const ENCADRANTS = new Set<Bloc["genre"]>([
  "tableau",
  "encadre",
  "code",
  "schema",
]);

/** L'écart qui précède un bloc, selon ce qui le précède. */
function ecart(bloc: Bloc, precedent: Bloc | undefined): number {
  if (!precedent) return 0;
  if (bloc.genre === "titre") return TITRES[Math.min(bloc.niveau, 4)]!.avant;
  if (precedent.genre === "titre") return precedent.niveau <= 2 ? 2.2 : 1.4;
  if (ENCADRANTS.has(bloc.genre) || ENCADRANTS.has(precedent.genre)) return 3.5;
  return 2.4;
}

/** Le gras seul sur sa ligne, en tête d'encadré : « **OBJECTIF 1** ». */
function etiquetteDe(bloc: Bloc | undefined): string | null {
  if (!bloc || bloc.genre !== "paragraphe" || bloc.lignes.length !== 1)
    return null;
  const m = bloc.lignes[0]!.match(/^\*\*([^*]+)\*\*\s*:?$/);
  if (!m || m[1]!.length > 90) return null;
  return m[1]!;
}

function dessinerBlocs(
  doc: jsPDF,
  blocs: Bloc[],
  cadre: CadreMarkdown,
  profondeur: number,
): number {
  let y = cadre.y;
  const place = (h: number) => {
    y = cadre.place(h);
    return y;
  };
  /** Change de page si `h` ne tient pas, mais seulement si une page neuve y suffit. */
  const tenir = (h: number, plafond: number) => {
    if (cadre.reste && cadre.saut && h > cadre.reste() && h <= plafond)
      y = cadre.saut();
    return y;
  };

  blocs.forEach((bloc, n) => {
    const espace = ecart(bloc, blocs[n - 1]);
    if (espace) place(espace);

    switch (bloc.genre) {
      case "titre": {
        const style = TITRES[Math.min(bloc.niveau, 4)]!;
        const lignes = couper(
          doc,
          segmenter(bloc.texte),
          cadre.largeur,
          style.taille,
          style.couleur,
          style.role,
        );
        // Un titre ne finit jamais une page : il part avec le début de ce
        // qu'il annonce. Sur le cours de 109 pages, une dizaine de titres
        // d'atelier restaient seuls au pied d'une page.
        const suivant = blocs[n + 1];
        const suite = suivant
          ? debutInsecable(doc, suivant, cadre.largeur) + 2.4
          : 0;
        tenir(lignes.length * style.interligne + 3 + suite, 80);
        for (const l of lignes) {
          place(style.interligne);
          peindre(doc, l, cadre.x, y, style.taille);
        }
        if (bloc.niveau === 1) {
          place(2.4);
          doc.setDrawColor(...COULEURS.encre);
          doc.setLineWidth(0.5);
          doc.line(cadre.x, y, cadre.x + cadre.largeur, y);
          place(0.6);
        }
        break;
      }

      case "paragraphe": {
        // Pas de première ligne seule en bas de page. Un gras seul sur sa
        // ligne — « **Fusion des types redondants** » — sert de titre : il
        // part, comme un titre, avec ce qu'il annonce.
        const suivant = blocs[n + 1];
        const intertitre = etiquetteDe(bloc) !== null && suivant;
        tenir(
          intertitre
            ? TEXTE.interligne +
                2.4 +
                debutInsecable(doc, suivant, cadre.largeur)
            : Math.min(bloc.lignes.length, 2) * TEXTE.interligne,
          intertitre ? 80 : 20,
        );
        bloc.lignes.forEach((l, k) => {
          if (k > 0) place(0.6);
          for (const ligne of couper(
            doc,
            segmenter(l),
            cadre.largeur,
            TEXTE.taille,
            COULEURS.corps,
          )) {
            place(TEXTE.interligne);
            peindre(doc, ligne, cadre.x, y, TEXTE.taille);
          }
        });
        break;
      }

      case "media": {
        const segments = [
          { texte: bloc.texte, gras: false, italique: true, code: false },
        ];
        for (const ligne of couper(
          doc,
          segments,
          cadre.largeur,
          TEXTE.taille,
          COULEURS.corps,
        )) {
          place(TEXTE.interligne);
          peindre(doc, ligne, cadre.x, y, TEXTE.taille);
        }
        break;
      }

      case "liste": {
        bloc.elements.forEach((el, k) => {
          if (k > 0) place(1.1);
          const indent = 6 + el.niveau * 5.5;
          const xm = cadre.x + indent;
          const lignes = couper(
            doc,
            segmenter(el.texte),
            cadre.largeur - indent,
            TEXTE.taille,
            COULEURS.corps,
          );
          tenir(Math.min(lignes.length, 2) * TEXTE.interligne, 20);
          lignes.forEach((l, i) => {
            place(TEXTE.interligne);
            peindre(doc, l, xm, y, TEXTE.taille);
            if (i > 0) return;
            if (el.coche !== null) {
              doc.setDrawColor(...COULEURS.ardoise);
              doc.setLineWidth(0.25);
              doc.rect(xm - 4.6, y - 2.6, 2.8, 2.8);
              if (el.coche) {
                police(doc, "corpsGras", 8.5);
                doc.setTextColor(...COULEURS.sarcelle);
                doc.text("✓", xm - 4.3, y - 0.2);
              }
            } else if (el.ordonne) {
              police(doc, "corpsGras", TEXTE.taille);
              doc.setTextColor(...COULEURS.sarcelle);
              doc.text(el.marque, xm - 1.4, y, { align: "right" });
            } else {
              police(doc, "corps", TEXTE.taille);
              doc.setTextColor(...COULEURS.sarcelle);
              doc.text(el.niveau === 0 ? "•" : "–", xm - 3.6, y);
            }
          });
        });
        break;
      }

      case "filet": {
        place(2);
        doc.setDrawColor(...COULEURS.bordure);
        doc.setLineWidth(0.3);
        doc.line(cadre.x, y, cadre.x + cadre.largeur, y);
        place(2);
        break;
      }

      case "encadre": {
        // L'étiquette peut ouvrir un paragraphe par un retour forcé —
        // « **À retenir**␣␣ » puis le texte : elle s'en détache.
        const premier = bloc.enfants[0];
        const tete =
          premier?.genre === "paragraphe"
            ? ({
                genre: "paragraphe",
                lignes: premier.lignes.slice(0, 1),
              } as Bloc)
            : premier;
        const etiquette = etiquetteDe(tete);
        const reste =
          premier?.genre === "paragraphe" && premier.lignes.length > 1
            ? [{ genre: "paragraphe", lignes: premier.lignes.slice(1) } as Bloc]
            : [];
        const enfants = etiquette
          ? [...reste, ...bloc.enfants.slice(1)]
          : bloc.enfants;
        y = encadrer(doc, cadre, y, {
          profondeur,
          etiquette,
          contenu: (interieur) =>
            dessinerBlocs(doc, enfants, interieur, profondeur + 1),
          mesure: (largeur) => mesurerBlocs(doc, enfants, largeur),
        });
        break;
      }

      case "code": {
        const lignesDe = (largeur: number) => {
          police(doc, "mono", 8);
          return bloc.lignes.flatMap((l) =>
            l.trim()
              ? (doc.splitTextToSize(
                  l.replace(/\s+$/, ""),
                  largeur,
                ) as string[])
              : [""],
          );
        };
        y = encadrer(doc, cadre, y, {
          profondeur,
          etiquette: null,
          code: true,
          contenu: (interieur) => {
            let yi = interieur.y;
            for (const l of lignesDe(interieur.largeur)) {
              yi = interieur.place(3.9);
              police(doc, "mono", 8);
              doc.setTextColor(...COULEURS.encre);
              doc.text(l, interieur.x, yi);
            }
            return yi;
          },
          mesure: (largeur) => lignesDe(largeur).length * 3.9,
        });
        break;
      }

      case "schema": {
        // Le JSON n'a rien à faire sur un dossier d'administration. On
        // imprime ce que le stagiaire a construit, dans les mêmes termes que
        // le correcteur automatique l'a lu : les écrans, leurs liaisons, ce
        // qui n'est relié à rien.
        const lu = analyser(bloc.corps);
        const enfants: Bloc[] = decrire(
          lu ?? { formes: [], fleches: [], traits: [] },
        )
          .split("\n")
          .filter((l) => l.trim())
          .map((l) => ({ genre: "paragraphe", lignes: [litteral(l)] }));
        y = encadrer(doc, cadre, y, {
          profondeur,
          etiquette: "Schéma",
          contenu: (interieur) =>
            dessinerBlocs(doc, enfants, interieur, profondeur + 1),
          mesure: (largeur) => mesurerBlocs(doc, enfants, largeur),
        });
        break;
      }

      case "tableau": {
        y = dessinerTableau(doc, bloc, cadre, tenir);
        break;
      }
    }
  });

  return y;
}

/**
 * Un encadré : fond léger, filet d'accent à gauche, étiquette éventuelle.
 *
 * Le fond se peint par bandes, à chaque réservation de hauteur, juste avant
 * le texte qu'elle accueille : il suit donc le contenu d'une page à l'autre
 * sans qu'on ait à savoir d'avance où la page coupera. Les bandes sont
 * décalées vers le bas de la profondeur des jambages — sinon chaque bande
 * repeindrait le bas des lettres de la ligne d'avant.
 *
 * Un encadré court qui ne tient pas en bas de page passe en entier à la
 * suivante : une étiquette « À RETENIR » séparée de ce qu'il faut retenir ne
 * sert à rien.
 */
function encadrer(
  doc: jsPDF,
  cadre: CadreMarkdown,
  depart: number,
  o: {
    profondeur: number;
    etiquette: string | null;
    code?: boolean;
    contenu: (interieur: CadreMarkdown) => number;
    mesure: (largeur: number) => number;
  },
): number {
  const PAD_X = 4.5;
  const PAD_HAUT = 1.2;
  const PAD_BAS = 3.2;
  const JAMBAGE = 1.3;
  const H_ETIQUETTE = 5.4;
  const largeur = cadre.largeur - PAD_X * 2;
  const fond = o.profondeur === 0 ? COULEURS.lavis : COULEURS.blanc;
  const accent = o.code
    ? COULEURS.ardoise
    : o.profondeur === 0
      ? COULEURS.sarcelle
      : COULEURS.bordureForte;

  let y = depart;
  const total =
    PAD_HAUT +
    (o.etiquette ? H_ETIQUETTE : 0) +
    o.mesure(largeur) +
    PAD_BAS +
    1;
  if (cadre.reste && cadre.saut && total > cadre.reste() && total <= 90)
    y = cadre.saut();

  const bande = (h: number) => {
    y = cadre.place(h);
    doc.setFillColor(...fond);
    doc.rect(cadre.x, y - h + JAMBAGE, cadre.largeur, h, "F");
    doc.setFillColor(...accent);
    doc.rect(cadre.x, y - h + JAMBAGE, 0.9, h, "F");
    return y;
  };

  bande(PAD_HAUT);
  if (o.etiquette) {
    bande(H_ETIQUETTE - 1.2);
    police(doc, "mono", 7.5);
    doc.setTextColor(...COULEURS.sarcelle);
    const texte = imprimable(o.etiquette.replace(/\\(.)/g, "$1")).toUpperCase();
    doc.text(
      doc.splitTextToSize(texte, largeur)[0] as string,
      cadre.x + PAD_X,
      y,
    );
    bande(1.2);
  }
  y = o.contenu({
    x: cadre.x + PAD_X,
    largeur,
    y,
    place: bande,
    reste: cadre.reste,
    saut: cadre.saut
      ? () => {
          y = cadre.saut!();
          return y;
        }
      : undefined,
  });
  bande(PAD_BAS);
  return y;
}

/**
 * Un tableau.
 *
 * Les colonnes se partagent la largeur selon ce qu'elles contiennent : une
 * colonne « ID » de trois caractères n'a pas à prendre autant de place qu'une
 * colonne de verbatims. À parts égales, une grille de profils à neuf colonnes
 * coupait « Recommandation » en deux et étirait chaque rangée sur quinze
 * lignes.
 *
 * L'en-tête se répète en haut de chaque page où le tableau se poursuit : un
 * tableau de 46 profils sur quatre pages ne se lit pas sans.
 */
function dessinerTableau(
  doc: jsPDF,
  bloc: Extract<Bloc, { genre: "tableau" }>,
  cadre: CadreMarkdown,
  tenir: (h: number, plafond: number) => number,
): number {
  const TAILLE = 8.5;
  const TAILLE_ENTETE = 8;
  const INTERLIGNE = 3.9;
  const PAD = 1.8;
  const colonnes = Math.max(
    bloc.entetes.length,
    ...bloc.rangees.map((r) => r.length),
  );
  const cellules = (r: string[]) =>
    Array.from({ length: colonnes }, (_, c) => segmenter(r[c] ?? ""));
  const entetes = cellules(bloc.entetes);
  const rangees = bloc.rangees.map(cellules);

  // ── Largeurs ──
  //
  // Chaque colonne a un minimum — son mot le plus long — et un idéal — son
  // contenu sur une seule ligne. La place qui reste au-delà des minimums se
  // répartit au prorata de ce qui manque à chacune pour atteindre son idéal.
  const toutes = (c: number): [Segment[], boolean][] => [
    [entetes[c]!, true],
    ...rangees.map((r) => [r[c]!, false] as [Segment[], boolean]),
  ];
  const naturelle = (segs: Segment[], entete: boolean) =>
    couper(
      doc,
      segs,
      10_000,
      entete ? TAILLE_ENTETE : TAILLE,
      COULEURS.corps,
      entete ? "corpsGras" : "corps",
    )[0]!.largeur;
  const motLePlusLong = (segs: Segment[], entete: boolean) =>
    Math.max(
      0,
      ...segs.flatMap((s) => {
        police(
          doc,
          s.code ? "mono" : s.gras || entete ? "corpsGras" : "corps",
          entete ? TAILLE_ENTETE : TAILLE,
        );
        return imprimable(s.texte)
          .split(/\s+/)
          .map((m) => doc.getTextWidth(m));
      }),
    );
  const mini: number[] = [];
  const maxi: number[] = [];
  for (let c = 0; c < colonnes; c++) {
    const plusLong = Math.max(
      ...toutes(c).map(([s, e]) => motLePlusLong(s, e)),
    );
    mini[c] = Math.min(plusLong + PAD * 2 + 0.6, cadre.largeur * 0.35);
    maxi[c] = Math.max(
      mini[c]!,
      ...toutes(c).map(([s, e]) => naturelle(s, e) + PAD * 2 + 0.6),
    );
  }
  const somme = (t: number[]) => t.reduce((a, b) => a + b, 0);
  let largeurs: number[];
  if (somme(maxi) <= cadre.largeur) {
    largeurs = maxi.map((m) => (m * cadre.largeur) / somme(maxi));
  } else if (somme(mini) >= cadre.largeur) {
    largeurs = mini.map((m) => (m * cadre.largeur) / somme(mini));
  } else {
    const souplesse = somme(maxi.map((m, c) => m - mini[c]!));
    largeurs = mini.map(
      (m, c) =>
        m + ((cadre.largeur - somme(mini)) * (maxi[c]! - m)) / souplesse,
    );
  }
  const abscisses = [cadre.x];
  for (const l of largeurs)
    abscisses.push(abscisses[abscisses.length - 1]! + l);

  // Une colonne qui ne contient que des cases ou des coches se centre.
  const centree = Array.from(
    { length: colonnes },
    (_, c) =>
      bloc.alignements[c] === "centre" ||
      (rangees.length > 0 &&
        rangees.every((r) =>
          /^[\s☐✓✗✅❌○●–-]*$/.test(r[c]!.map((s) => s.texte).join("")),
        )),
  );

  const mettreEnLignes = (r: Segment[][], entete: boolean) =>
    r.map((segs, c) =>
      entete
        ? couper(
            doc,
            segs,
            largeurs[c]! - PAD * 2,
            TAILLE_ENTETE,
            COULEURS.blanc,
            "corpsGras",
          )
        : couper(doc, segs, largeurs[c]! - PAD * 2, TAILLE, COULEURS.corps),
    );
  const hauteurDe = (lignes: Ligne[][]) =>
    Math.max(1, ...lignes.map((l) => l.length)) * INTERLIGNE + PAD * 2 - 0.4;

  const tracer = (
    lignes: Ligne[][],
    haut: number,
    hauteur: number,
    entete: boolean,
    rang: number,
  ) => {
    doc.setFillColor(
      ...(entete
        ? COULEURS.encre
        : rang % 2 === 1
          ? COULEURS.papierAlt
          : COULEURS.blanc),
    );
    doc.rect(cadre.x, haut, cadre.largeur, hauteur, "F");
    doc.setDrawColor(...COULEURS.bordure);
    doc.setLineWidth(0.2);
    for (let c = 1; c < colonnes; c++)
      doc.line(abscisses[c]!, haut, abscisses[c]!, haut + hauteur);
    doc.line(cadre.x, haut + hauteur, cadre.x + cadre.largeur, haut + hauteur);
    if (!entete) {
      doc.line(cadre.x, haut, cadre.x, haut + hauteur);
      doc.line(
        cadre.x + cadre.largeur,
        haut,
        cadre.x + cadre.largeur,
        haut + hauteur,
      );
    }
    lignes.forEach((cel, c) => {
      cel.forEach((l, k) => {
        const x =
          centree[c] && !entete
            ? abscisses[c]! + (largeurs[c]! - l.largeur) / 2
            : bloc.alignements[c] === "droite" && !entete
              ? abscisses[c]! + largeurs[c]! - PAD - l.largeur
              : abscisses[c]! + PAD;
        peindre(
          doc,
          l,
          x,
          haut + PAD + 2.9 + k * INTERLIGNE,
          entete ? TAILLE_ENTETE : TAILLE,
        );
      });
    });
  };

  // Un en-tête aux cellules vides — `| | |`, pour un tableau de chiffres —
  // ne s'imprime pas : il faisait une barre sombre sans rien dedans.
  const sansEntete = entetes.every(
    (segs) =>
      !segs
        .map((s) => s.texte)
        .join("")
        .trim(),
  );
  const lignesEntete = mettreEnLignes(entetes, true);
  const hEntete = sansEntete ? 0 : hauteurDe(lignesEntete);
  const page = () => doc.getCurrentPageInfo().pageNumber;

  // L'en-tête ne part jamais seul : il emmène au moins sa première rangée.
  const premiere = rangees[0]
    ? hauteurDe(mettreEnLignes(rangees[0], false))
    : 0;
  let y = tenir(hEntete + premiere + 1, 100);
  if (!sansEntete) {
    y = cadre.place(hEntete);
    tracer(lignesEntete, y - hEntete, hEntete, true, 0);
  }

  rangees.forEach((r, i) => {
    const lignes = mettreEnLignes(r, false);
    const h = hauteurDe(lignes);
    const avant = page();
    y = cadre.place(h);
    let haut = y - h;
    if (page() !== avant && !sansEntete) {
      // Nouvelle page : l'en-tête d'abord, la rangée dessous.
      tracer(lignesEntete, haut, hEntete, true, 0);
      y = cadre.place(hEntete);
      haut += hEntete;
    }
    tracer(lignes, haut, h, false, i);
  });
  return y;
}

/**
 * Dessine le markdown et renvoie l'ordonnée atteinte.
 *
 * `place` reste à l'appelant : c'est lui qui sait où sont ses marges, quand
 * changer de page et quel en-tête reposer.
 *
 * TOUTE avancée verticale passe par `place`, y compris les respirations entre
 * blocs. Un `y += 2` local paraît anodin ; il ne l'est pas. L'appelant tient
 * sa propre ordonnée, et ces millimètres ne lui parvenaient pas : les deux
 * positions dérivaient, de sorte qu'un bloc posé d'après `place` — un tableau,
 * qui se dessine à une ordonnée calculée et non ligne à ligne — venait
 * recouvrir le paragraphe qui le précédait.
 */
export function dessinerMarkdown(
  doc: jsPDF,
  markdown: string,
  cadre: CadreMarkdown,
): number {
  return dessinerBlocs(doc, lireBlocs(markdown), cadre, 0);
}
