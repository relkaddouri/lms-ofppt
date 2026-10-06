/**
 * Mettre en forme un corrigé écrit d'un seul tenant.
 *
 * Les corrigés produits jusqu'ici énumèrent leurs éléments dans le fil du
 * texte : « Éléments attendus : (1) Objectif clair : … (2) Profil : … (3) Cinq
 * questions ouvertes : … ». Sur un écran comme sur le dossier déposé à
 * l'administration, cela donne six lignes pleines où l'on cherche où commence
 * le troisième point.
 *
 * Le générateur les écrit désormais en Markdown, mais les contrôles déjà
 * corrigés gardent leur prose — et ce sont ceux-là qu'il faut déposer. On les
 * remet en forme à l'affichage, sans toucher à ce qui est enregistré : le
 * texte du formateur reste le sien, mot pour mot.
 *
 * Rien n'est inventé ni reformulé. On ne fait que couper là où le corrigé
 * numérotait déjà.
 */

/** Au moins deux repères qui se suivent : (1) … (2) … */
const ENUMERATION = /\((\d{1,2})\)\s*/g;

/**
 * Le libellé d'un élément, mis en valeur.
 *
 * « Objectif clair : comprendre le vécu… » devient « **Objectif clair** :
 * comprendre le vécu… ». On ne s'y risque que sur un libellé court et sans
 * ponctuation forte : au-delà, ce deux-points appartient à la phrase et non à
 * une rubrique.
 */
function enValeur(element: string): string {
  // `[\s\S]` plutôt que le drapeau `s` : le projet cible ES2017.
  const m = /^([^:;.!?'"«»]{2,40}?)\s*:\s*([\s\S]+)$/.exec(element);
  return m ? `**${m[1]!.trim()}** : ${m[2]!.trim()}` : element;
}

/**
 * Rend le corrigé en Markdown, ou tel quel s'il n'y a rien à faire.
 *
 * On s'abstient dès que le texte porte déjà une mise en forme — un tableau,
 * une liste, un saut de ligne volontaire : il a alors été écrit ainsi, et le
 * redécouper le défigurerait.
 */
export function corrigeStructure(texte: string): string {
  const brut = texte.trim();
  if (!brut) return brut;

  // Déjà mis en forme : on ne touche à rien.
  if (brut.includes("\n")) return brut;

  const reperes = [...brut.matchAll(ENUMERATION)];
  // Il en faut au moins deux, et ils doivent se suivre : « (1) … (2) … ».
  // Un « (3) » isolé au milieu d'une phrase n'est pas une énumération.
  if (reperes.length < 2) return enRubriques(brut) ?? brut;
  const numeros = reperes.map((m) => Number(m[1]));
  const suivis = numeros.every((n, i) => i === 0 || n === numeros[i - 1]! + 1);
  if (!suivis || numeros[0] !== 1) return enRubriques(brut) ?? brut;

  const intro = brut.slice(0, reperes[0]!.index).trim();
  const elements: string[] = [];
  reperes.forEach((m, i) => {
    const debut = m.index! + m[0].length;
    const fin = i + 1 < reperes.length ? reperes[i + 1]!.index! : brut.length;
    const contenu = brut.slice(debut, fin).trim().replace(/[.;,]\s*$/, "");
    if (contenu) elements.push(`${i + 1}. ${enValeur(contenu)}`);
  });

  if (elements.length < 2) return brut;
  return [intro, "", ...elements].filter((l, i) => i !== 0 || l).join("\n");
}

/**
 * Les rubriques énoncées à la file : « Parcours principaux : … Motivations :
 * … Points bloquants : … ».
 *
 * Même intention que l'énumération numérotée, autre écriture. Le corrigé de la
 * question la plus lourde du contrôle prend cette forme, et c'est justement
 * celui qu'on relit le plus.
 *
 * Une rubrique se reconnaît à trois signes réunis : elle ouvre le texte ou
 * suit un point, elle commence par une majuscule, et son deux-points vient
 * après quelques mots sans ponctuation. Il en faut au moins trois pour qu'on
 * y touche — deux peuvent être une tournure de phrase.
 */
// Le point qui précède est capturé plutôt que regardé derrière : le projet
// cible ES2017, qui ne connaît pas encore le lookbehind.
const RUBRIQUE = /(^|\.\s)([A-ZÀÂÉÈÊËÎÏÔÖÙÛÜÇ][^.:;!?]{2,34}?)\s:\s/g;

function enRubriques(brut: string): string | null {
  const reperes = [...brut.matchAll(RUBRIQUE)];
  if (reperes.length < 3) return null;

  /** Où commence le libellé, une fois le point d'avant mis de côté. */
  const debutLibelle = (m: RegExpMatchArray) => m.index! + m[1]!.length;

  const lignes: string[] = [];
  reperes.forEach((m, i) => {
    const debut = m.index! + m[0].length;
    const fin =
      i + 1 < reperes.length ? debutLibelle(reperes[i + 1]!) : brut.length;
    const contenu = brut.slice(debut, fin).trim().replace(/\s*\.$/, "");
    if (contenu) lignes.push(`- **${m[2]!.trim()}** : ${contenu}`);
  });

  if (lignes.length < 3) return null;
  const intro = brut.slice(0, debutLibelle(reperes[0]!)).trim();
  return [intro, intro ? "" : null, ...lignes]
    .filter((l): l is string => l !== null && l !== "")
    .join("\n");
}
