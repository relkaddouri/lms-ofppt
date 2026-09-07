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
      segments.push({ texte: t.slice(2, -2), gras: true, italique: false, code: false });
    } else if (t.startsWith("`")) {
      segments.push({ texte: t.slice(1, -1), gras: false, italique: false, code: true });
    } else {
      segments.push({ texte: t.slice(1, -1), gras: false, italique: true, code: false });
    }
    position = debut + t.length;
  }
  if (position < ligne.length) segments.push(brut(ligne.slice(position)));
  return segments.length > 0 ? segments : [brut(ligne)];
}

function brut(texte: string): Segment {
  return { texte, gras: false, italique: false, code: false };
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
    .trim();
}

