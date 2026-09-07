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

/** Hauteur qu'une carte occupera, pour égaliser les rangées. */
function hauteurCarte(doc: jsPDF, c: Carte, largeur: number): number {
  const dispo = largeur - px(3);
  let h = py(2.66) * 2;
  police(doc, "mono", 9.5);
  if (c.intitule) {
    h += (doc.splitTextToSize(c.intitule, dispo) as string[]).length * taille(9.5) * 1.35 + py(0.6);
  }
  police(doc, "corps", 14);
  if (c.titre) {
    h += (doc.splitTextToSize(c.titre, dispo) as string[]).length * taille(14) * 1.35 + py(0.6);
  }
  for (const l of c.lignes) {
    h += (doc.splitTextToSize(l.texte, dispo - (l.puce ? 4 : 0)) as string[]).length * taille(14) * 1.35 + py(0.3);
  }
  return Math.max(h, py(22.82));
}

function dessinerBloc(doc: jsPDF, b: BlocDiapo, y: number): number {
  if (b.type === "sousTitre") {
    return ecrire(doc, b.texte, MARGE, y + taille(16), LARGEUR, {
      role: "titre",
      pt: 16,
      couleur: COULEURS.encre,
    });
  }

  if (b.type === "texte") {
    return ecrire(doc, b.texte, MARGE, y + taille(14), LARGEUR, { pt: 14 });
  }

  if (b.type === "liste") {
    let curseur = y;
    b.items.forEach((it, i) => {
      curseur += taille(14);
      if (b.ordonnee) {
        police(doc, "mono", 11.5);
        doc.setTextColor(...COULEURS.ardoiseClaire);
        doc.text(String(i + 1).padStart(2, "0"), MARGE, curseur);
      } else {
        doc.setFillColor(...COULEURS.sarcelle);
        doc.circle(MARGE + 1.2, curseur - taille(14) * 0.35, 0.8, "F");
      }
      curseur = ecrire(doc, it, MARGE + 7, curseur, LARGEUR - 7, { pt: 14 });
      curseur += py(0.4);
    });
    return curseur;
  }

  if (b.type === "cartes") {
    const colonnes = 2;
    const gouttiere = px(2.25);
    const largeur = (LARGEUR - gouttiere) / colonnes;
    let curseur = y;
    for (let i = 0; i < b.cartes.length; i += colonnes) {
      const rangee = b.cartes.slice(i, i + colonnes);
      const h = Math.max(...rangee.map((c) => hauteurCarte(doc, c, largeur)));
      rangee.forEach((c, k) => {
        dessinerCarte(doc, c, MARGE + k * (largeur + gouttiere), curseur, largeur, h);
      });
      curseur += h + py(2);
    }
    return curseur;
  }

  // ── Tableau ──
  const colonnes = b.entetes.length;
  const largeur = LARGEUR / colonnes;
  const hLigne = taille(11) * 2.1;
  let curseur = y;

  doc.setFillColor(...COULEURS.encre);
  doc.rect(MARGE, curseur, LARGEUR, hLigne, "F");
  police(doc, "corpsGras", 11);
  doc.setTextColor(...COULEURS.blanc);
  b.entetes.forEach((e, k) => {
    doc.text(
      (doc.splitTextToSize(e, largeur - 4) as string[])[0] ?? "",
      MARGE + k * largeur + 2,
      curseur + hLigne * 0.68,
    );
  });
  curseur += hLigne;

  police(doc, "corps", 11);
  for (const ligne of b.lignes) {
    const hauteurs = ligne.map(
      (c) => (doc.splitTextToSize(c, largeur - 4) as string[]).length,
    );
    const h = Math.max(1, ...hauteurs) * taille(11) * 1.35 + 2;
    doc.setDrawColor(...COULEURS.separateur);
    doc.setLineWidth(0.2);
    doc.line(MARGE, curseur, MARGE + LARGEUR, curseur);
    ligne.forEach((c, k) => {
      police(doc, k === 0 ? "corpsGras" : "corps", 11);
      doc.setTextColor(...(k === 0 ? COULEURS.encre : COULEURS.corps));
      let sous = curseur + taille(11) * 1.15;
      for (const l of doc.splitTextToSize(c, largeur - 4) as string[]) {
        doc.text(l, MARGE + k * largeur + 2, sous);
        sous += taille(11) * 1.35;
      }
    });
    curseur += h;
  }
  return curseur;
}

function dessinerDiapo(doc: jsPDF, d: Diapo, numero: number, pied: string) {
  if (d.type === "couverture" || d.type === "intercalaire") {
    doc.setFillColor(...COULEURS.encre);
    doc.rect(0, 0, L, H, "F");
    const couverture = d.type === "couverture";

    pastilles(doc, px(6), py(10.67), px(1.65), px(2.175));

    ecrire(doc, d.surtitre, px(6), py(couverture ? 19.33 : 20) + taille(11), px(86.25), {
      role: "mono",
      pt: 11,
      couleur: COULEURS.ardoiseClaire,
    });

    let y = ecrire(
      doc,
      d.titre,
      px(6),
      py(couverture ? 26.67 : 29.33) + taille(couverture ? 44 : 40),
      px(86.25),
      {
        role: "titre",
        pt: couverture ? 44 : 40,
        couleur: COULEURS.blanc,
        interligne: taille(couverture ? 44 : 40) * 1.12,
      },
    );

    if (d.sousTitre) {
      y = ecrire(doc, d.sousTitre, px(6), py(couverture ? 49.33 : 46), px(82.5), {
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
        curseur = ecrire(doc, m.valeur, px(6), curseur + taille(12.5) * 1.3, px(86.25), {
          pt: 12.5,
          couleur: COULEURS.bordureForte,
        });
        curseur += py(1.2);
      }
    }
    return;
  }

  doc.setFillColor(...COULEURS.blanc);
  doc.rect(0, 0, L, H, "F");

  pastilles(doc, px(4.65), py(7.73), px(1.2), px(1.575));
  ecrire(doc, d.surtitre, px(10.88), py(6.67) + taille(10.5), px(71.25), {
    role: "mono",
    pt: 10.5,
    couleur: COULEURS.ardoiseClaire,
  });
  ecrire(
    doc,
    d.type === "sommaire" ? "Sommaire" : d.titre,
    MARGE,
    py(11.33) + taille(26),
    LARGEUR,
    { role: "titre", pt: 26, couleur: COULEURS.encre, interligne: taille(26) * 1.15 },
  );

  let y = py(23.33);
  if (d.type === "sommaire") {
    d.entrees.forEach((e, i) => {
      y += taille(14) * 1.6;
      police(doc, "titre", 11);
      doc.setTextColor(...COULEURS.sarcelle);
      doc.text(String(i), MARGE, y);
      ecrire(doc, e, MARGE + 8, y, LARGEUR - 8, { pt: 14 });
    });
  } else {
    for (const b of d.blocs) {
      y = dessinerBloc(doc, b, y);
      y += py(2.4);
    }
  }

  police(doc, "mono", 8.5);
  doc.setTextColor(...COULEURS.ardoiseClaire);
  doc.text(pied, MARGE, py(94.4) + taille(8.5));
  doc.text(String(numero), L - MARGE, py(94.4) + taille(8.5), { align: "right" });
}

export async function telechargerDiapositivesPdf(
  markdown: string,
  contexte: { surtitre: string; pied: string },
  nomFichier: string,
): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: [L, H], orientation: "landscape" });
  await installerPolices(doc);

  const diapos = decouperEnDiapositives(markdown, contexte);
  diapos.forEach((d, i) => {
    if (i > 0) doc.addPage([L, H], "landscape");
    dessinerDiapo(doc, d, i + 1, contexte.pied);
  });

  doc.save(nomFichier);
}
