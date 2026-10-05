import type jsPDF from "jspdf";
import { COULEURS, police } from "@/lib/pdf-theme";
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
 * Ce que ce moteur couvre : titres, paragraphes, listes à puces et numérotées,
 * citations, filets, code, tableaux, schémas, et le gras, l'italique et le
 * code en ligne. Ce qu'il ne couvre pas, faute de sens sur du papier : les
 * images et les liens cliquables — une URL s'imprime alors en toutes lettres,
 * ce qui est la seule forme utilisable sur papier. La liste est explicite
 * pour que le trou se voie plutôt que de surprendre.
 *
 * Les tableaux ont longtemps manqué, « faute de support de jsPDF ». jsPDF ne
 * les connaît pas, en effet, mais il sait tracer des rectangles et poser du
 * texte — c'est tout ce qu'un tableau demande. Le trou s'est vu le jour où
 * les stagiaires ont rendu des fiches persona et des user journey maps : le
 * dossier remis à l'administration imprimait des barres verticales.
 */

export type CadreMarkdown = {
  /** Abscisse du bord gauche du texte. */
  x: number;
  largeur: number;
  /** Ordonnée de la première ligne. */
  y: number;
  /** Appelée avant d'écrire : doit réserver la hauteur et rendre l'ordonnée. */
  place: (hauteur: number) => number;
};

/**
 * Dessine le markdown et renvoie l'ordonnée atteinte.
 *
 * `place` reste à l'appelant : c'est lui qui sait où sont ses marges, quand
 * changer de page et quel en-tête reposer. Ce moteur ne fait que du texte.
 */
/**
 * La hauteur que `dessinerMarkdown` occupera, sans rien tracer.
 *
 * Mesurer autrement — compter les lignes à la main — se paie toujours : le
 * fond coloré d'un bloc était tracé d'après une estimation, et le texte
 * débordait dessous dès que le moteur n'espaçait pas comme la formule le
 * supposait. Ici c'est le même code qui mesure et qui dessine, donc les deux
 * ne peuvent pas diverger.
 *
 * On neutralise les appels qui peignent, on garde ceux qui mesurent. Les
 * changements de page sont ignorés : un fond s'arrête au bas de la page de
 * toute façon, et c'est à l'appelant de décider s'il coupe.
 */
export function mesurerMarkdown(
  doc: jsPDF,
  markdown: string,
  largeur: number,
): number {
  const MUETS = new Set([
    "text",
    "rect",
    "line",
    "setFillColor",
    "setDrawColor",
    "setLineWidth",
    "setTextColor",
  ]);
  const silencieux = new Proxy(doc, {
    get(cible, nom: string) {
      if (MUETS.has(nom)) return () => silencieux;
      const valeur = Reflect.get(cible, nom) as unknown;
      return typeof valeur === "function" ? valeur.bind(cible) : valeur;
    },
  }) as jsPDF;

  let y = 0;
  dessinerMarkdown(silencieux, markdown, {
    x: 0,
    largeur,
    y,
    place: (hauteur) => {
      y += hauteur;
      return y;
    },
  });
  return y;
}

export function dessinerMarkdown(
  doc: jsPDF,
  markdown: string,
  cadre: CadreMarkdown,
): number {
  let y = cadre.y;

  const ecrireSegments = (
    segments: Segment[],
    taille: number,
    indent: number,
    couleur: readonly [number, number, number],
    interligne: number,
  ) => {
    // Le retour à la ligne se calcule sur le texte nu, puis chaque ligne est
    // repeinte segment par segment : mesurer en gras ce qui sera écrit en
    // maigre décalerait tout.
    const nu = segments.map((s) => s.texte).join("");
    const lignes: string[] = doc.splitTextToSize(nu, cadre.largeur - indent);

    let consomme = 0;
    for (const ligne of lignes) {
      y = cadre.place(interligne);
      let x = cadre.x + indent;
      let restant = ligne.length;
      let curseur = consomme;

      while (restant > 0) {
        // Segment auquel appartient le caractère courant.
        let cumul = 0;
        const seg = segments.find((s) => {
          cumul += s.texte.length;
          return curseur < cumul;
        });
        if (!seg) break;
        const debutSeg = cumul - seg.texte.length;
        const dispo = Math.min(restant, cumul - curseur);
        const morceau = seg.texte.slice(curseur - debutSeg, curseur - debutSeg + dispo);

        police(doc, seg.code ? "mono" : seg.gras ? "corpsGras" : "corps", taille);
        doc.setTextColor(...(seg.code ? COULEURS.ardoise : couleur));
        doc.text(morceau, x, y);
        x += doc.getTextWidth(morceau);

        curseur += dispo;
        restant -= dispo;
      }
      // `splitTextToSize` mange l'espace de coupure : on le repasse.
      consomme = curseur + (curseur < nu.length && nu[curseur] === " " ? 1 : 0);
    }
  };

  const blocs = markdown.replace(/\r\n/g, "\n").split("\n");

  for (let i = 0; i < blocs.length; i++) {
    const ligne = blocs[i]!;
    const nue = ligne.trim();

    if (!nue) {
      y += 2;
      continue;
    }

    // ── Filet ──
    if (/^(?:---|\*\*\*|___)$/.test(nue)) {
      y = cadre.place(5);
      doc.setDrawColor(...COULEURS.separateur);
      doc.setLineWidth(0.3);
      doc.line(cadre.x, y - 1.5, cadre.x + cadre.largeur, y - 1.5);
      y += 1;
      continue;
    }

    // ── Titres ──
    const titre = nue.match(/^(#{1,6})\s+(.*)$/);
    if (titre) {
      const niveau = titre[1]!.length;
      const taille = niveau === 1 ? 12.5 : niveau === 2 ? 11 : 10;
      y += 3;
      const segments = segmenter(titre[2]!);
      const nu = segments.map((s) => s.texte).join("");
      police(doc, "titre", taille);
      doc.setTextColor(...COULEURS.encre);
      for (const l of doc.splitTextToSize(nu, cadre.largeur)) {
        y = cadre.place(taille * 0.55);
        doc.text(l, cadre.x, y);
      }
      y += 1.5;
      continue;
    }

    // ── Citation ──
    const citation = nue.match(/^>\s?(.*)$/);
    if (citation) {
      const avant = y;
      ecrireSegments(segmenter(citation[1]!), 9.5, 5, COULEURS.corps, 4.6);
      doc.setDrawColor(...COULEURS.bordureForte);
      doc.setLineWidth(0.8);
      doc.line(cadre.x + 1, avant - 3, cadre.x + 1, y + 1);
      continue;
    }

    // ── Schéma dessiné ──
    //
    // Le JSON n'a rien à faire sur un dossier d'administration. On imprime ce
    // que le stagiaire a construit, dans les mêmes termes que le correcteur
    // automatique l'a lu : les écrans, leurs liaisons, ce qui n'est relié à
    // rien.
    if (nue === "```schema") {
      const corps: string[] = [];
      i += 1;
      while (i < blocs.length && blocs[i]!.trim() !== "```") {
        corps.push(blocs[i]!);
        i += 1;
      }
      const lu = analyser(corps.join("\n"));
      y += 1;
      police(doc, "mono", 7);
      doc.setTextColor(...COULEURS.ardoise);
      y = cadre.place(4);
      doc.text("SCHÉMA", cadre.x, y);
      const haut = y;
      for (const l of decrire(lu ?? { formes: [], fleches: [], traits: [] }).split("\n")) {
        if (!l.trim()) {
          y += 1.5;
          continue;
        }
        police(doc, "corps", 9);
        doc.setTextColor(...COULEURS.corps);
        for (const d of doc.splitTextToSize(l, cadre.largeur - 5)) {
          y = cadre.place(4.4);
          doc.text(d, cadre.x + 5, y);
        }
      }
      doc.setDrawColor(...COULEURS.bordureForte);
      doc.setLineWidth(0.8);
      doc.line(cadre.x + 1, haut - 2, cadre.x + 1, y + 1);
      y += 2.5;
      continue;
    }

    // ── Tableau ──
    //
    // L'en-tête est reconnu à sa ligne de tirets. Les colonnes se partagent
    // la largeur à parts égales : calculer leur contenu pour les pondérer
    // demanderait deux passes, et une fiche persona ou une journey map
    // s'accommode très bien de colonnes régulières.
    if (nue.startsWith("|") && /^\|?[\s:|-]*-[\s:|-]*\|?$/.test((blocs[i + 1] ?? "").trim())) {
      const cellulesDe = (l: string) =>
        l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
      const entetes = cellulesDe(nue);
      i += 2;
      const corps: string[][] = [];
      while (i < blocs.length && blocs[i]!.trim().startsWith("|")) {
        corps.push(cellulesDe(blocs[i]!));
        i += 1;
      }
      i -= 1;

      const colonnes = entetes.length;
      const largeurCol = cadre.largeur / colonnes;
      const PAD = 1.6;

      /** Une rangée : hauteur mesurée d'abord, puis tracée d'un bloc. */
      const rangee = (cellules: string[], entete: boolean) => {
        police(doc, entete ? "corpsGras" : "corps", 8.5);
        const parCellule = Array.from({ length: colonnes }, (_, c) =>
          doc.splitTextToSize(cellules[c] ?? "", largeurCol - PAD * 2) as string[],
        );
        const lignesMax = Math.max(1, ...parCellule.map((l) => l.length));
        const hauteur = lignesMax * 3.9 + PAD * 2;
        // `place` réserve la hauteur et rend le BAS de l'espace obtenu : le
        // haut de la rangée s'en déduit en retranchant cette hauteur. Un
        // décalage fixe — j'avais écrit « − 3 » — faisait démarrer chaque
        // rangée près du bas de son espace, et son cadre mordait d'autant sur
        // la rangée suivante. C'est ce qui écrivait les lignes les unes sur
        // les autres.
        const haut = cadre.place(hauteur) - hauteur;

        if (entete) {
          doc.setFillColor(...COULEURS.encre);
          doc.rect(cadre.x, haut, cadre.largeur, hauteur, "F");
        }
        doc.setDrawColor(...COULEURS.separateur);
        doc.setLineWidth(0.2);
        for (let c = 0; c <= colonnes; c += 1) {
          const x = cadre.x + c * largeurCol;
          doc.line(x, haut, x, haut + hauteur);
        }
        doc.line(cadre.x, haut + hauteur, cadre.x + cadre.largeur, haut + hauteur);
        if (!entete) doc.line(cadre.x, haut, cadre.x + cadre.largeur, haut);

        if (entete) doc.setTextColor(255, 255, 255);
        else doc.setTextColor(...COULEURS.corps);
        parCellule.forEach((lignes, c) => {
          lignes.forEach((l, k) => {
            doc.text(l, cadre.x + c * largeurCol + PAD, haut + PAD + 2.8 + k * 3.9);
          });
        });
        y = haut + hauteur;
      };

      y += 1.5;
      rangee(entetes, true);
      for (const r of corps) rangee(r, false);
      y += 3;
      continue;
    }

    // ── Listes ──
    const puce = nue.match(/^[-*+]\s+(.*)$/);
    const numero = nue.match(/^(\d+)\.\s+(.*)$/);
    if (puce || numero) {
      const marque = puce ? "•" : `${numero![1]}.`;
      const contenu = puce ? puce[1]! : numero![2]!;
      const avant = y;
      ecrireSegments(segmenter(contenu), 9.5, 9, COULEURS.corps, 4.5);
      police(doc, "corps", 9.5);
      doc.setTextColor(...COULEURS.ardoise);
      doc.text(marque, cadre.x + 3, avant + (y > avant ? 4.5 : 0));
      continue;
    }

    // ── Paragraphe ──
    ecrireSegments(segmenter(nue), 9.5, 0, COULEURS.corps, 4.6);
    y += 1;
  }

  return y;
}
