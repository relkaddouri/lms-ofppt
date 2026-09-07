import { jsPDF } from "jspdf";
import {
  COULEURS,
  installerPolices,
  police,
  type RolePolice,
} from "@/lib/pdf-theme";
import { analyser, enTeteDocument, type Noeud } from "@/lib/diapos";
import { segmenter } from "@/lib/markdown";
import { colonnesCategorielles } from "@/lib/tableaux";

/**
 * Le support du stagiaire en A4, dessiné en PDF (PRD §4.4).
 *
 * Le document passait jusqu'ici par la boîte d'impression du navigateur. Le
 * formateur ne veut pas imprimer : il veut un fichier, qu'il dépose, envoie,
 * archive. Le diaporama 16:9 a fait ce chemin le premier ; le document le
 * suit, avec les mêmes gains — polices embarquées depuis `public/polices`
 * plutôt que dépendantes de ce que le navigateur avait chargé, rendu
 * vectoriel, et une pagination qui mesure au lieu d'estimer.
 *
 * La mise en page reprend celle de `DocumentRedige` : mêmes dispositifs, mêmes
 * tailles converties de pixels CSS en millimètres. Les deux lisent le même
 * `analyser`, donc l'écran montre ce que le fichier contiendra.
 *
 * Une réserve assumée : il n'y a pas de fonte italique embarquée. Un passage
 * en italique sort en romain plutôt que dans une italique simulée, qui se voit
 * toujours. Les légendes, seul usage réglé de l'italique dans le support de
 * référence, passent de toute façon en petites capitales monospace.
 */

// ── Géométrie ─────────────────────────────────────────────────────────────

const L = 210;
const H = 297;
const MARGE = 16;
const HAUT = 18;
/** Sous cette ordonnée, plus rien : le pied de page vit à 285. */
const BAS = 273;
const LARGEUR = L - 2 * MARGE;

/** Un pixel CSS vaut 1/96 de pouce, soit 0,2646 mm. */
const mm = (px: number) => px * 0.2646;
/** Les tailles de police se donnent en points : 1 px CSS = 0,75 pt. */
const pts = (px: number) => px * 0.75;

/** Écart entre deux blocs — le `gap-3` de l'écran. */
const ECART = mm(12);

type Rvb = readonly [number, number, number];

function rvb(hex: string): Rvb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Les teintes du design system que `pdf-theme` ne porte pas encore. */
const TEINTE = {
  paperAlt: rvb("#FAFBFC"),
  washStrong: rvb("#F2F4F7"),
  tintTeal: rvb("#E8F2F7"),
  tintTealFort: rvb("#CBE0EA"),
  tintGreen: rvb("#CFE4D8"),
  tintAlertFort: rvb("#F3CFCB"),
  bgSuccess: rvb("#EAF3EE"),
  bgAlert: rvb("#FCEDEB"),
  tealSombre: rvb("#245F79"),
  vertSombre: rvb("#2C6C46"),
  corailSombre: rvb("#B8433A"),
  ardoise2: rvb("#5B6A7D"),
} as const;

type Teinte = { fond: Rvb; trait: Rvb };

/** Les trois teintes d'encadré, dans l'ordre où elles tournent. */
const ENCADRES: Teinte[] = [
  { fond: TEINTE.bgSuccess, trait: TEINTE.tintGreen },
  { fond: TEINTE.tintTeal, trait: TEINTE.tintTealFort },
  { fond: COULEURS.papier, trait: COULEURS.bordure },
];

/** La palette des pastilles, dans l'ordre des rangs de `lib/tableaux`. */
const PASTILLES: (Teinte & { encre: Rvb })[] = [
  { fond: TEINTE.tintTeal, trait: TEINTE.tintTealFort, encre: TEINTE.tealSombre },
  { fond: TEINTE.bgSuccess, trait: TEINTE.tintGreen, encre: TEINTE.vertSombre },
  { fond: TEINTE.bgAlert, trait: TEINTE.tintAlertFort, encre: TEINTE.corailSombre },
  { fond: TEINTE.washStrong, trait: COULEURS.bordure, encre: TEINTE.ardoise2 },
];

/** Couleur du numéro de section, tournante comme dans le support de référence. */
const NUMEROS = [
  COULEURS.corail,
  COULEURS.sarcelle,
  COULEURS.vert,
  COULEURS.encre,
] as const;

// ── Texte enrichi ─────────────────────────────────────────────────────────

type Style = { role: RolePolice; couleur: Rvb; pt: number };
type Morceau = { texte: string; style: Style };

/**
 * Découpe une ligne markdown en morceaux stylés.
 *
 * Le gras compte : le support de référence l'utilise pour poser le mot clé
 * d'un paragraphe. L'écrire en romain ferait perdre l'appui visuel qui
 * distingue une définition d'une phrase.
 */
function morceaux(brut: string, base: Style): Morceau[] {
  const sortie: Morceau[] = [];

  const pousser = (t: string) => {
    for (const s of segmenter(t)) {
      if (!s.texte) continue;
      sortie.push({
        texte: s.texte,
        style: {
          role: s.code ? "mono" : s.gras ? "corpsGras" : base.role,
          couleur: s.gras || s.code ? COULEURS.encre : base.couleur,
          pt: s.code ? base.pt * 0.92 : base.pt,
        },
      });
    }
  };

  // Les liens d'abord : leur syntaxe englobe du texte qui peut être en gras.
  const motifLien = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  let position = 0;
  for (const trouve of brut.matchAll(motifLien)) {
    if (trouve.index > position) pousser(brut.slice(position, trouve.index));
    sortie.push({
      texte: trouve[1]!,
      style: { ...base, couleur: COULEURS.sarcelle },
    });
    position = trouve.index + trouve[0].length;
  }
  if (position < brut.length) pousser(brut.slice(position));
  return sortie;
}

/**
 * Répartit des morceaux en lignes tenant dans une largeur.
 *
 * Le découpage se fait mot à mot et non morceau par morceau : une phrase dont
 * le milieu est en gras doit couper n'importe où, pas seulement aux frontières
 * de style. C'est ce que `splitTextToSize` ne sait pas faire, lui qui ne
 * connaît qu'une police à la fois.
 */
/** La ponctuation haute française, qui ne commence jamais une ligne. */
const PONCTUATION_HAUTE = /^[?!:;»%]$/;

/**
 * Découpe un texte en unités insécables.
 *
 * En français, le point d'interrogation, le point-virgule, les deux-points et
 * le guillemet fermant se posent après une espace — mais cette espace ne se
 * coupe pas. Sans cette règle, « et comment ? » laisse son point
 * d'interrogation seul en tête de la ligne suivante, ce qu'on voit tout de
 * suite dans un document imprimé. Le guillemet ouvrant obéit à la règle
 * symétrique : il ne finit pas une ligne.
 */
function unites(texte: string): string[] {
  const bruts = texte.split(/(\s+)/).filter(Boolean);
  const sortie: string[] = [];
  for (let i = 0; i < bruts.length; i++) {
    const t = bruts[i]!;
    const suivant = bruts[i + 1];
    if (
      /^\s+$/.test(t) &&
      suivant &&
      PONCTUATION_HAUTE.test(suivant) &&
      sortie.length > 0
    ) {
      sortie[sortie.length - 1] += t + suivant;
      i++;
      continue;
    }
    if (t === "«" && bruts[i + 1] && bruts[i + 2]) {
      sortie.push(t + bruts[i + 1] + bruts[i + 2]);
      i += 2;
      continue;
    }
    sortie.push(t);
  }
  return sortie;
}

function enLignes(doc: jsPDF, mx: Morceau[], largeur: number): Morceau[][] {
  const lignes: Morceau[][] = [[]];
  let x = 0;

  for (const m of mx) {
    police(doc, m.style.role, m.style.pt);
    for (const mot of unites(m.texte)) {
      const blanc = !/\S/.test(mot);
      const largeurMot = doc.getTextWidth(mot);
      if (blanc && x === 0) continue; // pas d'espace en tête de ligne
      if (!blanc && x > 0 && x + largeurMot > largeur) {
        lignes.push([]);
        x = 0;
      }
      lignes[lignes.length - 1]!.push({ texte: mot, style: m.style });
      x += largeurMot;
    }
  }
  return lignes.filter((l) => l.length > 0);
}

function poserLignes(
  doc: jsPDF,
  lignes: Morceau[][],
  x: number,
  y: number,
  interligne: number,
): number {
  let curseur = y;
  for (const ligne of lignes) {
    let cx = x;
    for (const m of ligne) {
      police(doc, m.style.role, m.style.pt);
      doc.setTextColor(...m.style.couleur);
      doc.text(m.texte, cx, curseur);
      cx += doc.getTextWidth(m.texte);
    }
    curseur += interligne;
  }
  return curseur;
}

// ── Pagination ────────────────────────────────────────────────────────────

type Flux = { doc: jsPDF; y: number; pages: number };

function pageSuivante(f: Flux) {
  f.doc.addPage("a4", "portrait");
  f.pages += 1;
  f.y = HAUT;
}

/** Réserve `hauteur` sur la page courante, en ouvrant la suivante s'il le faut. */
function place(f: Flux, hauteur: number) {
  if (f.y + hauteur > BAS && f.y > HAUT) pageSuivante(f);
}

// ── Blocs ─────────────────────────────────────────────────────────────────

const CORPS: Style = { role: "corps", couleur: COULEURS.corps, pt: pts(14) };
const INTERLIGNE = pts(14) * 1.625 * 0.3528;

/** Un texte courant : sa hauteur, puis son tracé. */
function bloc(
  doc: jsPDF,
  brut: string,
  largeur: number,
  style: Style = CORPS,
  interligne = INTERLIGNE,
) {
  const lignes = enLignes(doc, morceaux(brut, style), largeur);
  return {
    hauteur: lignes.length * interligne,
    poser: (x: number, y: number) =>
      poserLignes(doc, lignes, x, y + interligne * 0.75, interligne),
  };
}

/**
 * Rend une suite de nœuds dans une colonne.
 *
 * `mesurer` fait le même parcours sans rien peindre : c'est ce qui permet de
 * connaître la hauteur d'un encadré avant de le poser, sans écrire deux fois
 * la mise en page — et donc sans qu'elles divergent.
 */
function rendre(
  f: Flux,
  noeuds: Noeud[],
  x: number,
  largeur: number,
  mesurer: boolean,
): number {
  const doc = f.doc;
  let y = f.y;
  let rangSection = 0;

  /** Avance de `h`, en paginant si l'on peint. */
  const avancer = (h: number) => {
    if (!mesurer) {
      place(f, h);
      y = f.y;
    }
    const depart = y;
    y += h;
    if (!mesurer) f.y = y;
    return depart;
  };

  const estLegende = (n: Noeud | undefined) =>
    n?.k === "p" && /^\*[^*]+\*$/.test(n.brut.trim());

  let i = 0;
  while (i < noeuds.length) {
    const n = noeuds[i]!;
    if (i > 0) {
      y += ECART;
      if (!mesurer) f.y = y;
    }

    // ── Titres ────────────────────────────────────────────────────────────
    if (n.k === "h") {
      if (n.niveau === 1) {
        const b = bloc(
          doc,
          n.texte,
          largeur,
          { role: "titre", couleur: COULEURS.encre, pt: pts(26) },
          pts(26) * 1.15 * 0.3528,
        );
        const yy = avancer(b.hauteur);
        if (!mesurer) b.poser(x, yy);
        i++;
        continue;
      }

      if (n.niveau === 2) {
        const numero = n.texte.match(/^(\d+)[.)]\s*(.*)$/);
        const legende = estLegende(noeuds[i + 1])
          ? (noeuds[i + 1] as { texte: string })
          : null;
        const couleur = NUMEROS[rangSection % NUMEROS.length]!;
        rangSection++;

        const decalage = numero ? mm(26) : 0;
        const bTitre = bloc(
          doc,
          numero ? numero[2]! : n.texte,
          largeur - decalage,
          { role: "titre", couleur: COULEURS.encre, pt: pts(19) },
          pts(19) * 1.35 * 0.3528,
        );
        const hLegende = legende ? mm(15) : 0;
        // Le filet et sa marge basse, comme le `border-b pb-2` de l'écran.
        const hauteur = hLegende + bTitre.hauteur + mm(10);
        // Un titre de section seul en bas de page n'annonce rien : on lui
        // demande la place de deux lignes de corps derrière lui.
        if (!mesurer) place(f, hauteur + INTERLIGNE * 2);
        const yy = avancer(hauteur);

        if (!mesurer) {
          if (legende) {
            police(doc, "mono", pts(10.5));
            doc.setTextColor(...COULEURS.ardoiseClaire);
            doc.text(
              legende.texte.replace(/^\*|\*$/g, "").toLocaleUpperCase("fr"),
              x,
              yy + mm(9),
            );
          }
          if (numero) {
            police(doc, "titre", pts(26));
            doc.setTextColor(...couleur);
            doc.text(numero[1]!, x, yy + hLegende + mm(19));
          }
          bTitre.poser(x + decalage, yy + hLegende + mm(4.5));
          doc.setDrawColor(...COULEURS.bordureForte);
          doc.setLineWidth(0.3);
          const filet = yy + hauteur - mm(5);
          doc.line(x, filet, x + largeur, filet);
        }
        i += legende ? 2 : 1;
        continue;
      }

      const grand = n.niveau === 3;
      const b = bloc(doc, n.texte, largeur, {
        role: "titre",
        couleur: grand ? COULEURS.encre : COULEURS.corps,
        pt: pts(grand ? 15.5 : 14),
      });
      // Un titre seul en bas de page n'annonce rien : on lui demande la place
      // de deux lignes de corps derrière lui, comme aux titres de section.
      if (!mesurer) place(f, b.hauteur + ECART + INTERLIGNE * 2);
      const yy = avancer(b.hauteur);
      if (!mesurer) b.poser(x, yy);
      i++;
      continue;
    }

    // ── Encadrés consécutifs : une grille ────────────────────────────────
    if (n.k === "quote") {
      const groupes: string[][] = [];
      while (i < noeuds.length && noeuds[i]!.k === "quote") {
        groupes.push((noeuds[i] as { lignes: string[] }).lignes);
        i++;
      }
      y = grilleEncadres(f, groupes, x, largeur, y, mesurer);
      continue;
    }

    // ── Tableau ──────────────────────────────────────────────────────────
    if (n.k === "table") {
      y = tableau(f, n.entetes, n.lignes, x, largeur, y, mesurer);
      i++;
      continue;
    }

    // ── Listes ───────────────────────────────────────────────────────────
    if (n.k === "li") {
      const ordonnee = n.ordonnee;
      const items: string[] = [];
      while (i < noeuds.length && noeuds[i]!.k === "li") {
        const l = noeuds[i] as { brut: string; ordonnee: boolean };
        if (l.ordonnee !== ordonnee) break;
        items.push(l.brut);
        i++;
      }
      items.forEach((it, k) => {
        const retrait = mm(ordonnee ? 14 : 12);
        const b = bloc(doc, it, largeur - retrait);
        const h = b.hauteur + mm(6);
        const yy = avancer(h);
        if (!mesurer) {
          if (ordonnee) {
            police(doc, "mono", pts(13));
            doc.setTextColor(...COULEURS.corail);
            doc.text(`${k + 1}`, x, yy + INTERLIGNE * 0.75);
          } else {
            doc.setFillColor(...COULEURS.sarcelle);
            doc.circle(x + mm(3), yy + INTERLIGNE * 0.5, mm(2.5) / 2, "F");
          }
          b.poser(x + retrait, yy);
        }
      });
      continue;
    }

    if (n.k === "hr") {
      const yy = avancer(mm(6));
      if (!mesurer) {
        doc.setDrawColor(...COULEURS.separateur);
        doc.setLineWidth(0.3);
        doc.line(x, yy + mm(3), x + largeur, yy + mm(3));
      }
      i++;
      continue;
    }

    const b = bloc(doc, n.brut, largeur);
    const yy = avancer(b.hauteur);
    if (!mesurer) b.poser(x, yy);
    i++;
  }

  return y;
}

/**
 * Une rangée d'encadrés parallèles.
 *
 * Une rangée ne met côte à côte que des encadrés comparables : au-delà de
 * 320 signes, ils prennent la largeur. Un long paragraphe posé à côté de trois
 * notions brèves étire sa rangée et laisse deux colonnes aux trois quarts
 * vides — c'est ce qui donne l'impression de désordre.
 */
function grilleEncadres(
  f: Flux,
  groupes: string[][],
  x: number,
  largeur: number,
  yDepart: number,
  mesurer: boolean,
): number {
  const doc = f.doc;
  const long = groupes.some((g) => g.join(" ").length > 320);
  const colonnes =
    long || groupes.length === 1 ? 1 : groupes.length >= 3 ? 3 : 2;
  const gouttiere = mm(12);
  const largeurCase = (largeur - gouttiere * (colonnes - 1)) / colonnes;
  const marge = mm(16);

  let y = yDepart;

  for (let d = 0; d < groupes.length; d += colonnes) {
    const rangee = groupes.slice(d, d + colonnes);
    const contenus = rangee.map((lignes) => {
      const utiles = lignes.filter((l) => l.trim());
      const premiere = (utiles[0] ?? "").replace(/\*\*/g, "").trim();
      const intitule =
        premiere.length > 1 &&
        premiere.length <= 90 &&
        /\p{Lu}/u.test(premiere) &&
        premiere === premiere.toLocaleUpperCase("fr")
          ? premiere
          : null;
      const corps = analyser(utiles.slice(intitule ? 1 : 0).join("\n"));
      return { intitule, corps };
    });

    // L'intitulé se replie sur la largeur de l'encadré. Écrit d'un seul jet,
    // « FONCTIONNALITÉ · CE QUE LE PRODUIT FAIT » sortait de sa boîte et
    // passait sous celle d'à côté, qui le recouvrait.
    const intitules = contenus.map((c) =>
      c.intitule
        ? enLignes(
            doc,
            morceaux(c.intitule, {
              role: "mono",
              couleur: COULEURS.ardoiseClaire,
              pt: pts(10.5),
            }),
            largeurCase - marge * 2,
          )
        : [],
    );
    const interIntitule = pts(10.5) * 1.5 * 0.3528;

    // La hauteur d'un encadré se mesure en le rendant à blanc : son contenu
    // est un document à son tour, il peut porter une liste ou un tableau.
    const hauteurs = contenus.map((c, k) => {
      const feint: Flux = { doc, y: 0, pages: 0 };
      const h = rendre(feint, c.corps, 0, largeurCase - marge * 2, true);
      return (
        h +
        marge * 2 +
        (intitules[k]!.length > 0
          ? intitules[k]!.length * interIntitule + mm(8)
          : 0)
      );
    });

    // Les encadrés d'une rangée s'alignent sur le plus haut — c'est ce qui
    // fait la régularité de la grille. Mais seulement s'ils sont comparables :
    // une définition de deux lignes posée à côté d'un exemple de dix se
    // retrouvait dans une boîte aux trois quarts vide. Passé cet écart, chacun
    // reprend sa hauteur.
    const plusHaut = Math.max(...hauteurs);
    const comparables = Math.min(...hauteurs) >= plusHaut * 0.6;
    const hauteur = plusHaut;

    if (!mesurer) {
      place(f, hauteur);
      y = f.y;
    }

    rangee.forEach((_, k) => {
      if (mesurer) return;
      const cx = x + k * (largeurCase + gouttiere);
      const teinte =
        groupes.length > 1
          ? ENCADRES[(d + k) % ENCADRES.length]!
          : ENCADRES[2]!;
      doc.setFillColor(...teinte.fond);
      doc.setDrawColor(...teinte.trait);
      doc.setLineWidth(0.3);
      doc.roundedRect(
        cx,
        y,
        largeurCase,
        comparables ? hauteur : hauteurs[k]!,
        mm(12),
        mm(12),
        "FD",
      );

      const c = contenus[k]!;
      let cy = y + marge;
      if (intitules[k]!.length > 0) {
        cy = poserLignes(
          doc,
          intitules[k]!,
          cx + marge,
          cy + interIntitule * 0.75,
          interIntitule,
        );
        cy += mm(8) - interIntitule * 0.75;
      }
      // Le contenu d'un encadré ne pagine pas : la boîte est posée d'un bloc,
      // donc son intérieur suit la boîte.
      const interne: Flux = { doc, y: cy, pages: f.pages };
      rendre(interne, c.corps, cx + marge, largeurCase - marge * 2, false);
    });

    y += hauteur;
    if (!mesurer) f.y = y;
    if (d + colonnes < groupes.length) {
      y += mm(12);
      if (!mesurer) f.y = y;
    }
  }

  return y;
}

/** Un tableau à en-tête encre, coupé en gardant ses en-têtes. */
function tableau(
  f: Flux,
  entetes: string[],
  lignes: string[][],
  x: number,
  largeur: number,
  yDepart: number,
  mesurer: boolean,
): number {
  const doc = f.doc;
  const { enPastille, rang } = colonnesCategorielles(lignes, entetes.length);
  const pt13 = pts(13);
  const inter = pt13 * 1.45 * 0.3528;
  const padX = mm(12);
  const padY = mm(8);

  // Une colonne de catégories n'a pas besoin de la place d'une colonne de
  // phrases : on lui donne le tiers d'une part, et le reste se partage.
  const parts = entetes.map((_, k) => (enPastille.has(k) ? 0.45 : 1));
  const total = parts.reduce((a, b) => a + b, 0);
  const cols = parts.map((p) => (p / total) * largeur);
  const gauche = cols.map((_, k) => x + cols.slice(0, k).reduce((a, b) => a + b, 0));

  const hEntete = inter + padY * 2;
  let y = yDepart;

  const poserEntete = () => {
    doc.setFillColor(...COULEURS.encre);
    doc.rect(x, y, largeur, hEntete, "F");
    police(doc, "corpsGras", pt13);
    doc.setTextColor(...COULEURS.blanc);
    entetes.forEach((e, k) => {
      const l = enLignes(
        doc,
        morceaux(e, { role: "corpsGras", couleur: COULEURS.blanc, pt: pt13 }),
        cols[k]! - padX * 2,
      );
      doc.text(
        (l[0] ?? []).map((m) => m.texte).join(""),
        gauche[k]! + padX,
        y + padY + inter * 0.75,
      );
    });
    y += hEntete;
    if (!mesurer) f.y = y;
  };

  // Le plancher d'une ligne : une cellule vide vaut une ligne de texte. Les
  // tableaux à remplir du cahier d'atelier en sont faits, et une rangée sans
  // hauteur n'y laisse pas de quoi écrire.
  const hauteurLigne = (ligne: string[]) =>
    Math.max(
      inter,
      ...ligne.map((c, k) => {
        if (enPastille.has(k)) return inter;
        const st: Style = {
          role: k === 0 ? "corpsGras" : "corps",
          couleur: k === 0 ? COULEURS.encre : COULEURS.corps,
          pt: pt13,
        };
        return enLignes(doc, morceaux(c, st), cols[k]! - padX * 2).length * inter;
      }),
    ) + padY * 2;

  if (mesurer) {
    return (
      y + hEntete + lignes.reduce((t, l) => t + hauteurLigne(l), 0)
    );
  }

  place(f, hEntete + hauteurLigne(lignes[0] ?? []) * 2);
  y = f.y;
  poserEntete();

  lignes.forEach((ligne, index) => {
    const h = hauteurLigne(ligne);
    const suivante = lignes[index + 1];
    // Garde contre la ligne orpheline : la dernière ne part pas seule.
    const orpheline =
      index === lignes.length - 2 &&
      suivante !== undefined &&
      y + h + hauteurLigne(suivante) > BAS;
    if (y + h > BAS || orpheline) {
      pageSuivante(f);
      y = f.y;
      poserEntete();
    }

    if (index % 2 === 1) {
      doc.setFillColor(...TEINTE.paperAlt);
      doc.rect(x, y, largeur, h, "F");
    }
    doc.setDrawColor(...COULEURS.separateur);
    doc.setLineWidth(0.2);
    doc.line(x, y, x + largeur, y);

    ligne.forEach((c, k) => {
      const valeur = c.trim();
      if (enPastille.has(k) && valeur) {
        const p = PASTILLES[(rang.get(valeur) ?? 3) % PASTILLES.length]!;
        police(doc, "corpsGras", pts(11.5));
        const l = doc.getTextWidth(valeur) + mm(10);
        doc.setFillColor(...p.fond);
        doc.setDrawColor(...p.trait);
        doc.setLineWidth(0.2);
        doc.roundedRect(
          gauche[k]! + padX,
          y + padY - mm(2),
          l,
          inter + mm(2),
          inter / 2,
          inter / 2,
          "FD",
        );
        doc.setTextColor(...p.encre);
        doc.text(valeur, gauche[k]! + padX + mm(5), y + padY + inter * 0.72);
      } else {
        const st: Style = {
          role: k === 0 ? "corpsGras" : "corps",
          couleur: k === 0 ? COULEURS.encre : COULEURS.corps,
          pt: pt13,
        };
        poserLignes(
          doc,
          enLignes(doc, morceaux(c, st), cols[k]! - padX * 2),
          gauche[k]! + padX,
          y + padY + inter * 0.75,
          inter,
        );
      }
    });

    y += h;
    f.y = y;
  });

  return y;
}

/**
 * La page de couverture, reprise du support de référence.
 *
 * Un panneau encre encastré dans la page blanche, et non une page pleine :
 * c'est ce qui lui donne l'air d'un document relié plutôt que d'une bannière.
 * Le titre en haut, les métadonnées enfermées dans un cadre en bas, et entre
 * les deux le vide — qui fait la moitié de l'effet.
 */
function couverture(
  doc: jsPDF,
  entete: {
    titre: string;
    sousTitre: string | null;
    legende: string | null;
    meta: { cle: string; valeur: string }[];
  },
  surtitre: string | null,
) {
  const hautPanneau = HAUT;
  const basPanneau = H - HAUT;
  doc.setFillColor(...COULEURS.encre);
  doc.roundedRect(
    MARGE,
    hautPanneau,
    LARGEUR,
    basPanneau - hautPanneau,
    mm(14),
    mm(14),
    "F",
  );

  const x = MARGE + mm(48);
  const largeur = LARGEUR - mm(96);
  let y = hautPanneau + mm(56);

  [COULEURS.vert, COULEURS.sarcelle, COULEURS.corail].forEach((c, i) => {
    doc.setFillColor(...c);
    doc.circle(x + i * mm(16) + mm(5), y, mm(5), "F");
  });
  y += mm(34);

  if (surtitre) {
    police(doc, "mono", pts(11));
    doc.setTextColor(...COULEURS.ardoiseClaire);
    doc.text(surtitre.toLocaleUpperCase("fr"), x, y);
    y += mm(14);
  }

  y = poserLignes(
    doc,
    enLignes(
      doc,
      morceaux(entete.titre, {
        role: "titre",
        couleur: COULEURS.blanc,
        pt: pts(42),
      }),
      largeur,
    ),
    x,
    y + mm(30),
    pts(42) * 1.1 * 0.3528,
  );

  if (entete.sousTitre) {
    y = poserLignes(
      doc,
      enLignes(
        doc,
        morceaux(entete.sousTitre, {
          role: "corps",
          couleur: COULEURS.bordureForte,
          pt: pts(17),
        }),
        largeur,
      ),
      x,
      y + mm(10),
      pts(17) * 1.5 * 0.3528,
    );
  }

  if (entete.legende) {
    poserLignes(
      doc,
      enLignes(
        doc,
        morceaux(entete.legende, {
          role: "corps",
          couleur: COULEURS.ardoise,
          pt: pts(14.5),
        }),
        largeur,
      ),
      x,
      y + mm(6),
      pts(14.5) * 1.5 * 0.3528,
    );
  }

  if (entete.meta.length === 0) return;

  // Le cadre des métadonnées est ancré en bas : c'est le vide au-dessus qui
  // fait tenir la page, pas le remplissage.
  const inter = pts(13.5) * 1.6 * 0.3528;

  // La hauteur du cadre se mesure sur les valeurs réellement repliées : une
  // affectation longue — « Cité des Métiers et des Compétences Agadir · Pôle
  // Digital et IA » — tient sur deux lignes, et une hauteur comptée par entrée
  // la faisait déborder sous le fond.
  const entrees = entete.meta.map((m) => {
    police(doc, "corpsGras", pts(13.5));
    const largeurCle = doc.getTextWidth(m.cle) + mm(8);
    return {
      cle: m.cle,
      largeurCle,
      lignes: enLignes(
        doc,
        morceaux(m.valeur, {
          role: "corps",
          couleur: COULEURS.bordureForte,
          pt: pts(13.5),
        }),
        largeur - mm(40) - largeurCle,
      ),
    };
  });

  const hCadre =
    entrees.reduce((t, e) => t + e.lignes.length * inter, 0) + mm(28);
  const yCadre = basPanneau - mm(56) - hCadre;

  police(doc, "mono", pts(10.5));
  doc.setTextColor(...COULEURS.ardoiseClaire);
  doc.text("SUPPORT DE COURS DU STAGIAIRE", x, yCadre - mm(12));

  doc.setFillColor(62, 76, 96);
  doc.roundedRect(x, yCadre, largeur, hCadre, mm(10), mm(10), "F");

  let my = yCadre + mm(14) + inter * 0.75;
  for (const e of entrees) {
    police(doc, "corpsGras", pts(13.5));
    doc.setTextColor(...COULEURS.blanc);
    doc.text(e.cle, x + mm(20), my);
    poserLignes(doc, e.lignes, x + mm(20) + e.largeurCle, my, inter);
    my += e.lignes.length * inter;
  }
}

/** Le pied de page, posé sur chaque page sauf la couverture. */
function pieds(doc: jsPDF, pied: string, depuis: number) {
  const total = doc.getNumberOfPages();
  for (let p = depuis; p <= total; p++) {
    doc.setPage(p);
    police(doc, "mono", pts(9));
    doc.setTextColor(...COULEURS.ardoiseClaire);
    doc.text(pied, MARGE, H - 12);
    doc.text(String(p), L - MARGE, H - 12, { align: "right" });
  }
}

export async function telechargerDocumentPdf(
  markdown: string,
  contexte: { surtitre: string | null; pied: string },
  nomFichier: string,
): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  await installerPolices(doc);

  const noeuds = analyser(markdown);
  const entete = enTeteDocument(noeuds);

  // Pas de couverture sans métadonnées : un texte collé à la va-vite n'a pas à
  // se voir affublé d'une page de garde vide.
  const avecCouverture = Boolean(entete && entete.meta.length > 0);
  const corps = avecCouverture
    ? noeuds.slice(entete!.consommes)
    : noeuds;

  const f: Flux = { doc, y: HAUT, pages: 1 };
  if (avecCouverture) {
    couverture(doc, entete!, contexte.surtitre);
    pageSuivante(f);
  }

  rendre(f, corps, MARGE, LARGEUR, false);
  pieds(doc, contexte.pied, avecCouverture ? 2 : 1);

  doc.save(nomFichier);
}
