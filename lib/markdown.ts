/**
 * Analyse du markdown, sans rendu.
 *
 * Séparé des deux moteurs qui s'en servent — `components/TexteMarkdown` à
 * l'écran, `lib/pdf-markdown` sur le papier — parce que le diaporama en a
 * besoin lui aussi, et qu'il tourne dans le navigateur : lui faire importer le
 * module PDF embarquerait jsPDF dans le bundle pour trois expressions
 * régulières.
 */

export type Segment = { texte: string; gras: boolean; italique: boolean; code: boolean };

/**
 * Découpe une ligne en segments de style.
 *
 * `**gras**`, `*italique*`, `` `code` ``. Un balisage non fermé reste du texte
 * : le formateur qui écrit « 3 * 4 » ne doit pas voir la moitié de sa phrase
 * basculer en italique.
 */
export function segmenter(ligne: string): Segment[] {
  const segments: Segment[] = [];
  const motif = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let position = 0;

  for (const trouve of ligne.matchAll(motif)) {
    const debut = trouve.index;
    if (debut > position) {
      segments.push(brut(ligne.slice(position, debut)));
    }
    const t = trouve[0];
    if (t.startsWith("**")) {
      segments.push({ texte: desechapper(t.slice(2, -2)), gras: true, italique: false, code: false });
    } else if (t.startsWith("`")) {
      // Le contenu d'un code littéral se rend tel quel : la barre oblique y
      // est un caractère, pas une échappée.
      segments.push({ texte: t.slice(1, -1), gras: false, italique: false, code: true });
    } else {
      segments.push({ texte: desechapper(t.slice(1, -1)), gras: false, italique: true, code: false });
    }
    position = debut + t.length;
  }
  if (position < ligne.length) segments.push(brut(ligne.slice(position)));
  return segments.length > 0 ? segments : [brut(ligne)];
}

/**
 * Rend un caractère échappé à lui-même : `\[qui\]` devient `[qui]`.
 *
 * Un formateur qui écrit un gabarit à trous — « Des [qui], dans [quel
 * contexte] » — échappe ses crochets pour qu'un éditeur markdown n'y voie pas
 * un lien. Sans cette règle, les barres obliques ressortaient telles quelles à
 * l'écran comme dans le PDF, au milieu de la phrase à recopier.
 *
 * L'ensemble est celui de CommonMark, restreint à la ponctuation : une barre
 * oblique devant une lettre reste une barre oblique.
 */
function desechapper(texte: string): string {
  return texte.replace(/\\([\\`*_{}[\]()#+\-.!>|~])/g, "$1");
}

function brut(texte: string): Segment {
  return { texte: desechapper(texte), gras: false, italique: false, code: false };
}

/** Retire le balisage sans le rendre, pour mesurer ou pour un usage nu. */
export function texteNu(markdown: string): string {
  return markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*(?:---|\*\*\*|___)\s*$/gm, "")
    .replace(/\\([\\`*_{}[\]()#+\-.!>|~])/g, "$1")
    .trim();
}


export type DiapoMarkdown = { titre: string; points: string[] };

/**
 * Découpe un cours rédigé en diapositives.
 *
 * Chaque titre markdown ouvre une diapositive ; ce qui suit en fait les
 * points. Au-delà de quatre points, la diapositive est scindée — c'est la
 * règle qui vaut déjà pour les cours générés, et le mur de texte qu'elle
 * évite ne dépend pas de qui a écrit.
 *
 * Le texte avant le premier titre n'est pas perdu : il forme une diapositive
 * d'ouverture sans titre. Un formateur qui colle son cours ne commence pas
 * forcément par un `##`.
 */
export function decouperEnDiapos(
  markdown: string,
  titreParDefaut = "Cours",
): DiapoMarkdown[] {
  const groupes: DiapoMarkdown[] = [];
  let courant: DiapoMarkdown | null = null;

  for (const ligne of markdown.replace(/\r\n/g, "\n").split("\n")) {
    const nue = ligne.trim();
    if (!nue) continue;

    const titre = nue.match(/^#{1,6}\s+(.*)$/);
    if (titre) {
      courant = { titre: titre[1]!.trim(), points: [] };
      groupes.push(courant);
      continue;
    }

    // Un filet ne dit rien à l'oral : il sépare, il ne se projette pas.
    if (/^(?:---|\*\*\*|___)$/.test(nue)) continue;

    if (!courant) {
      courant = { titre: titreParDefaut, points: [] };
      groupes.push(courant);
    }
    courant.points.push(texteNu(nue));
  }

  // Quatre points par diapositive, comme les cours générés.
  const diapos: DiapoMarkdown[] = [];
  for (const g of groupes) {
    if (g.points.length === 0) {
      diapos.push(g);
      continue;
    }
    for (let k = 0; k < g.points.length; k += 4) {
      diapos.push({ titre: g.titre, points: g.points.slice(k, k + 4) });
    }
  }
  return diapos;
}
