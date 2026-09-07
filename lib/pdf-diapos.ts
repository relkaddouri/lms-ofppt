import { jsPDF } from "jspdf";
import { COULEURS, installerPolices, police } from "@/lib/pdf-theme";
import {
  decouperEnDiapositives,
  type BlocDiapo,
  type Carte,
  type Diapo,
} from "@/lib/diapos";

/**
 * Le diaporama 16:9, dessiné en PDF (PRD §4.4).
 *
 * Pourquoi ne pas imprimer la page, comme pour le document A4 : parce que
 * l'impression passe par une boîte de dialogue, et que le formateur veut un
 * fichier. Un diaporama s'y prête, sa mise en page étant régulière — des
 * blocs, des cartes, des tableaux, à des positions connues. Le document A4,
 * lui, coule sur plusieurs pages et se prête mal au même traitement.
 *
 * Deux gains en prime. Les polices sont **embarquées** par `pdf-theme` depuis
 * `public/polices` : le PDF sort en Sora et Source Sans quoi qu'il arrive, là
 * où l'impression dépendait de ce que le navigateur avait chargé. Et le
 * résultat est vectoriel, donc lisible à toutes les échelles.
 *
 * La géométrie reprend celle du rendu écran, elle-même relevée dans le support
 * de référence : le même modèle de diapositives alimente les deux, donc le
 * fichier montre ce que la classe verra.
 */

// 13,333 × 7,5 pouces en millimètres — le 16:9 de PowerPoint.
const L = 338.7;
const H = 190.5;

/** Les positions du support de référence, en pourcentage puis en mm. */
const px = (pourcent: number) => (pourcent / 100) * L;
const py = (pourcent: number) => (pourcent / 100) * H;
/** Un point vaut 1/72 de pouce, soit 0,3528 mm. */
const taille = (points: number) => points * 0.3528;

const MARGE = px(4.5);
const LARGEUR = px(90.75);

function pastilles(doc: jsPDF, x: number, y: number, d: number, ecart: number) {
  const teintes = [COULEURS.vert, COULEURS.sarcelle, COULEURS.corail];
  teintes.forEach((c, i) => {
    doc.setFillColor(...c);
    doc.circle(x + i * ecart + d / 2, y + d / 2, d / 2, "F");
  });
}

/** Écrit un texte et rend l'ordonnée atteinte. */
function ecrire(
  doc: jsPDF,
  texte: string,
  x: number,
  y: number,
  largeur: number,
  options: {
    role?: "titre" | "corps" | "corpsGras" | "mono";
    pt?: number;
    couleur?: readonly [number, number, number];
    interligne?: number;
  } = {},
): number {
  const { role = "corps", pt = 14, couleur = COULEURS.corps } = options;
  police(doc, role, pt);
  doc.setTextColor(...couleur);
  const interligne = options.interligne ?? taille(pt) * 1.35;
  let curseur = y;
  for (const ligne of doc.splitTextToSize(texte, largeur) as string[]) {
    doc.text(ligne, x, curseur);
    curseur += interligne;
  }
  return curseur;
}

function dessinerCarte(
  doc: jsPDF,
  c: Carte,
  x: number,
  y: number,
  largeur: number,
  hauteur: number,
) {
  const encre = c.accent === "encre";
  if (encre) doc.setFillColor(...COULEURS.encre);
  else if (c.accent === "sarcelle") doc.setFillColor(232, 242, 247);
  else doc.setFillColor(...COULEURS.blanc);
  doc.setDrawColor(...(encre ? COULEURS.encre : COULEURS.bordure));
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, largeur, hauteur, 2, 2, "FD");

  const dedans = x + px(1.5);
  const dispo = largeur - px(3);
  let curseur = y + py(2.66) + taille(9.5);

  if (c.intitule) {
    curseur = ecrire(doc, c.intitule.toUpperCase(), dedans, curseur, dispo, {
      role: "mono",
      pt: 9.5,
      couleur: encre ? COULEURS.ardoiseClaire : COULEURS.ardoiseClaire,
    });
    curseur += py(0.6);
  }
  if (c.titre) {
    curseur = ecrire(doc, c.titre, dedans, curseur, dispo, {
      role: "corpsGras",
      pt: 14,
      couleur: encre ? COULEURS.blanc : COULEURS.corps,
    });
    curseur += py(0.6);
  }
  for (const ligne of c.lignes) {
    if (ligne.puce) {
      doc.setFillColor(...(encre ? COULEURS.ardoiseClaire : COULEURS.sarcelle));
      doc.circle(dedans + 1, curseur - taille(14) * 0.35, 0.7, "F");
      curseur = ecrire(doc, ligne.texte, dedans + 4, curseur, dispo - 4, {
        pt: 14,
        couleur: encre ? COULEURS.lavis : COULEURS.corps,
      });
    } else {
      curseur = ecrire(doc, ligne.texte, dedans, curseur, dispo, {
        pt: 14,
        couleur: encre ? COULEURS.lavis : COULEURS.corps,
      });
    }
    curseur += py(0.3);
  }
}

/**
 * Hauteur naturelle d'une carte — ce que son contenu occupe réellement.
 *
 * Le plancher qui égalise les cartes d'une rangée est appliqué par l'appelant
 * et non ici : une carte seule sur sa ligne n'a personne à égaler, et le
 * plancher la laissait flotter dans une boîte aux trois quarts vide.
 */
function hauteurCarte(doc: jsPDF, c: Carte, largeur: number): number {
  const dispo = largeur - px(3);
  let h = py(2.66) * 2;
  if (c.intitule) {
    h += lignes(doc, c.intitule, dispo, "mono", 9.5) * taille(9.5) * 1.35 + py(0.6);
  }
  if (c.titre) {
    h += lignes(doc, c.titre, dispo, "corpsGras", 14) * taille(14) * 1.35 + py(0.6);
  }
  for (const l of c.lignes) {
    h +=
      lignes(doc, l.texte, dispo - (l.puce ? 4 : 0), "corps", 14) *
        taille(14) *
        1.35 +
      py(0.3);
  }
  return Math.max(h, py(9));
}

/** Nombre de lignes qu'un texte occupera dans une largeur donnée. */
function lignes(
  doc: jsPDF,
  texte: string,
  largeur: number,
  role: "titre" | "corps" | "corpsGras" | "mono",
  pt: number,
): number {
  police(doc, role, pt);
  return Math.max(1, (doc.splitTextToSize(texte, largeur) as string[]).length);
}

/**
 * L'ordonnée sous laquelle plus rien ne doit être dessiné.
 *
 * Le pied de page vit à 94,4 % ; on s'arrête franchement avant. C'est cette
 * limite, et non le calcul de découpe, qui garantit qu'aucune ligne ne
 * chevauche le pied : le modèle de diapositives estime un coût en lignes, ce
 * qui est bon pour répartir la matière, mais seule la mesure faite ici, avec
 * les vraies métriques des polices embarquées, sait ce qui tient vraiment.
 */
const BAS = py(90);

/** L'ordonnée où le corps commence, sous un titre qui peut tenir deux lignes. */
function hautDuCorps(doc: jsPDF, titre: string): number {
  const n = lignes(doc, titre, LARGEUR, "titre", 26);
  return Math.max(py(23.33), py(11.33) + n * taille(26) * 1.15 + py(3.5));
}

/** Le décor d'une diapositive de contenu, hors corps. Rend le haut du corps. */
function cadre(
  doc: jsPDF,
  surtitre: string,
  titre: string,
  numero: number,
  pied: string,
): number {
  doc.setFillColor(...COULEURS.blanc);
  doc.rect(0, 0, L, H, "F");

  pastilles(doc, px(4.65), py(7.73), px(1.2), px(1.575));
  ecrire(doc, surtitre, px(10.88), py(6.67) + taille(10.5), px(71.25), {
    role: "mono",
    pt: 10.5,
    couleur: COULEURS.ardoiseClaire,
  });
  ecrire(doc, titre, MARGE, py(11.33) + taille(26), LARGEUR, {
    role: "titre",
    pt: 26,
    couleur: COULEURS.encre,
    interligne: taille(26) * 1.15,
  });

  police(doc, "mono", 8.5);
  doc.setTextColor(...COULEURS.ardoiseClaire);
  doc.text(pied, MARGE, py(94.4) + taille(8.5));
  doc.text(String(numero), L - MARGE, py(94.4) + taille(8.5), {
    align: "right",
  });

  return hautDuCorps(doc, titre);
}

/**
 * L'état d'un dessin en cours : la page courante et de quoi en ouvrir une.
 *
 * Le titre est conservé pour être repris, suivi de « (suite) », en tête de
 * chaque page ajoutée — sans quoi une matière débordante atterrirait sur une
 * page sans en-tête, orpheline de ce qu'elle continue.
 */
type Flux = {
  doc: jsPDF;
  surtitre: string;
  titre: string;
  pied: string;
  numero: number;
  y: number;
};

function suivante(f: Flux) {
  f.doc.addPage([L, H], "landscape");
  f.numero += 1;
  const titre = /\(suite\)$/.test(f.titre) ? f.titre : `${f.titre} (suite)`;
  f.titre = titre;
  f.y = cadre(f.doc, f.surtitre, titre, f.numero, f.pied);
}

/** Réserve `hauteur` sur la page courante, en ouvrant la suivante s'il le faut. */
function place(f: Flux, hauteur: number) {
  if (f.y + hauteur > BAS && f.y > hautDuCorps(f.doc, f.titre)) suivante(f);
}

function dessinerBloc(f: Flux, b: BlocDiapo) {
  const doc = f.doc;

  if (b.type === "sousTitre") {
    const h = lignes(doc, b.texte, LARGEUR, "titre", 16) * taille(16) * 1.35;
    // Un sous-titre seul en bas de page n'a pas de sens : on lui demande la
    // place de deux lignes de corps derrière lui.
    place(f, h + taille(14) * 2.7);
    f.y = ecrire(doc, b.texte, MARGE, f.y + taille(16), LARGEUR, {
      role: "titre",
      pt: 16,
      couleur: COULEURS.encre,
    });
    return;
  }

  if (b.type === "texte") {
    const h = lignes(doc, b.texte, LARGEUR, "corps", 14) * taille(14) * 1.35;
    place(f, h);
    f.y = ecrire(doc, b.texte, MARGE, f.y + taille(14), LARGEUR, { pt: 14 });
    return;
  }

  if (b.type === "liste") {
    b.items.forEach((it, i) => {
      const h =
        lignes(doc, it, LARGEUR - 7, "corps", 14) * taille(14) * 1.35 + py(0.4);
      place(f, h);
      let curseur = f.y + taille(14);
      if (b.ordonnee) {
        police(doc, "mono", 11.5);
        doc.setTextColor(...COULEURS.ardoiseClaire);
        doc.text(String(i + 1).padStart(2, "0"), MARGE, curseur);
      } else {
        doc.setFillColor(...COULEURS.sarcelle);
        doc.circle(MARGE + 1.2, curseur - taille(14) * 0.35, 0.8, "F");
      }
      f.y = ecrire(doc, it, MARGE + 7, curseur, LARGEUR - 7, { pt: 14 }) + py(0.4);
    });
    return;
  }

  if (b.type === "cartes") {
    const gouttiere = px(2.25);
    for (let i = 0; i < b.cartes.length; i += 2) {
      const rangee = b.cartes.slice(i, i + 2);
      // Une carte seule prend toute la largeur : la demi-largeur laissait la
      // moitié droite de la diapositive vide.
      const seule = rangee.length === 1;
      const largeur = seule ? LARGEUR : (LARGEUR - gouttiere) / 2;
      const naturelle = Math.max(
        ...rangee.map((c) => hauteurCarte(doc, c, largeur)),
      );
      // Le plancher n'égalise que des cartes qui se font face.
      const h = seule ? naturelle : Math.max(naturelle, py(22.82));
      place(f, h + py(2));
      rangee.forEach((c, k) => {
        dessinerCarte(doc, c, MARGE + k * (largeur + gouttiere), f.y, largeur, h);
      });
      f.y += h + py(2);
    }
    return;
  }

  // ── Tableau ──
  const colonnes = b.entetes.length;
  const largeur = LARGEUR / colonnes;
  const hEntete = taille(11) * 2.1;

  const entete = () => {
    doc.setFillColor(...COULEURS.encre);
    doc.rect(MARGE, f.y, LARGEUR, hEntete, "F");
    police(doc, "corpsGras", 11);
    doc.setTextColor(...COULEURS.blanc);
    b.entetes.forEach((e, k) => {
      doc.text(
        (doc.splitTextToSize(e, largeur - 4) as string[])[0] ?? "",
        MARGE + k * largeur + 2,
        f.y + hEntete * 0.68,
      );
    });
    f.y += hEntete;
  };

  place(f, hEntete + taille(11) * 2.7);
  entete();

  const hauteurLigne = (ligne: string[]) =>
    Math.max(1, ...ligne.map((c) => lignes(doc, c, largeur - 4, "corps", 11))) *
      taille(11) *
      1.35 +
    2;

  b.lignes.forEach((ligne, i) => {
    const h = hauteurLigne(ligne);
    // Garde contre la ligne orpheline : si l'avant-dernière tient mais que la
    // dernière la suivrait seule sur la page suivante, on coupe une ligne plus
    // tôt et les deux voyagent ensemble.
    const derniere = b.lignes[i + 1];
    const orpheline =
      i === b.lignes.length - 2 &&
      derniere !== undefined &&
      f.y + h + hauteurLigne(derniere) > BAS;
    if (f.y + h > BAS || orpheline) {
      // L'en-tête est redessiné en tête de la page suivante : sans lui, les
      // colonnes d'un tableau coupé ne se lisent plus.
      suivante(f);
      entete();
    }
    doc.setDrawColor(...COULEURS.separateur);
    doc.setLineWidth(0.2);
    doc.line(MARGE, f.y, MARGE + LARGEUR, f.y);
    ligne.forEach((c, k) => {
      police(doc, k === 0 ? "corpsGras" : "corps", 11);
      doc.setTextColor(...(k === 0 ? COULEURS.encre : COULEURS.corps));
      let sous = f.y + taille(11) * 1.15;
      for (const l of doc.splitTextToSize(c, largeur - 4) as string[]) {
        doc.text(l, MARGE + k * largeur + 2, sous);
        sous += taille(11) * 1.35;
      }
    });
    f.y += h;
  });
}

/** Dessine une diapositive et rend le nombre de pages qu'elle a occupées. */
function dessinerDiapo(
  doc: jsPDF,
  d: Diapo,
  numero: number,
  pied: string,
): number {
  if (d.type === "couverture" || d.type === "intercalaire") {
    doc.setFillColor(...COULEURS.encre);
    doc.rect(0, 0, L, H, "F");
    const couverture = d.type === "couverture";

    pastilles(doc, px(6), py(10.67), px(1.65), px(2.175));

    ecrire(
      doc,
      d.surtitre,
      px(6),
      py(couverture ? 19.33 : 20) + taille(11),
      px(86.25),
      { role: "mono", pt: 11, couleur: COULEURS.ardoiseClaire },
    );

    const pt = couverture ? 44 : 40;
    // Le sous-titre suit le bas mesuré du titre. Posé à une ordonnée fixe, il
    // passait sous un titre d'une ligne et par-dessus un titre de deux.
    let y = ecrire(
      doc,
      d.titre,
      px(6),
      py(couverture ? 26.67 : 29.33) + taille(pt),
      px(86.25),
      {
        role: "titre",
        pt,
        couleur: COULEURS.blanc,
        interligne: taille(pt) * 1.12,
      },
    );

    if (d.sousTitre) {
      ecrire(doc, d.sousTitre, px(6), y + py(couverture ? 5 : 3.5), px(82.5), {
        pt: 18,
        couleur: COULEURS.bordureForte,
      });
    }

    if (couverture && d.meta.length > 0) {
      let curseur = py(66.67);
      for (const m of d.meta) {
        police(doc, "mono", 9.5);
        doc.setTextColor(...COULEURS.ardoiseClaire);
        doc.text(m.cle.toUpperCase(), px(6), curseur);
        curseur = ecrire(
          doc,
          m.valeur,
          px(6),
          curseur + taille(12.5) * 1.3,
          px(86.25),
          { pt: 12.5, couleur: COULEURS.bordureForte },
        );
        curseur += py(1.2);
      }
    }
    return 1;
  }

  const titre = d.type === "sommaire" ? "Sommaire" : d.titre;
  const f: Flux = {
    doc,
    surtitre: d.surtitre,
    titre,
    pied,
    numero,
    y: 0,
  };
  f.y = cadre(doc, d.surtitre, titre, numero, pied);

  if (d.type === "sommaire") {
    d.entrees.forEach((e, i) => {
      const h = lignes(doc, e, LARGEUR - 8, "corps", 14) * taille(14) * 1.6;
      place(f, h);
      f.y += taille(14) * 1.6;
      police(doc, "titre", 11);
      doc.setTextColor(...COULEURS.sarcelle);
      doc.text(String(i), MARGE, f.y);
      ecrire(doc, e, MARGE + 8, f.y, LARGEUR - 8, { pt: 14 });
    });
  } else {
    for (const b of d.blocs) {
      dessinerBloc(f, b);
      f.y += py(2.4);
    }
  }

  return f.numero - numero + 1;
}

export async function telechargerDiapositivesPdf(
  markdown: string,
  contexte: { surtitre: string; pied: string },
  nomFichier: string,
): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: [L, H], orientation: "landscape" });
  await installerPolices(doc);

  // Une diapositive de contenu sans bloc ne porterait que son titre et son
  // pied : une page blanche au milieu du diaporama.
  const diapos = decouperEnDiapositives(markdown, contexte).filter(
    (d) => d.type !== "contenu" || d.blocs.length > 0,
  );
  let numero = 1;
  diapos.forEach((d, i) => {
    if (i > 0) doc.addPage([L, H], "landscape");
    numero += dessinerDiapo(doc, d, numero, contexte.pied);
  });

  doc.save(nomFichier);
}
