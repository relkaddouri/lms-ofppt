/**
 * Un ordre propre à chaque stagiaire, et toujours le même pour lui.
 *
 * Deux voisins qui composent côte à côte n'ont pas les questions dans le même
 * ordre : regarder l'écran d'à côté ne renseigne plus sur la question qu'on a
 * sous les yeux. C'est le seul but, et il ne vaut que pendant la passation —
 * la correction, le sujet imprimé et l'affichage du résultat gardent l'ordre
 * d'origine, qui est celui que le formateur a composé.
 *
 * Le mélange est calculé, jamais enregistré : la même graine rend toujours la
 * même permutation. Un stagiaire qui recharge sa page, ou qui reprend depuis
 * un autre poste, retrouve exactement son ordre — sans quoi il perdrait le fil
 * en pleine épreuve. Et rien n'est à stocker ni à nettoyer.
 */

/** Hachage djb2 : de quoi transformer une chaîne en graine. */
function graineDe(texte: string): number {
  let h = 5381;
  for (let i = 0; i < texte.length; i += 1) {
    h = ((h << 5) + h + texte.charCodeAt(i)) & 0xffffffff;
  }
  // Une graine nulle bloquerait le générateur sur zéro.
  return (h >>> 0) || 1;
}

/**
 * Générateur déterministe (mulberry32).
 *
 * `Math.random` ne conviendrait pas : il rendrait un ordre différent à chaque
 * rendu, et les questions sauteraient sous le curseur du stagiaire.
 */
function generateur(graine: number): () => number {
  let a = graine;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Mélange une liste selon une graine, sans toucher à l'originale.
 *
 * Fisher-Yates : chaque permutation est également probable, ce qui n'est pas
 * le cas d'un tri par clé aléatoire.
 */
export function melangeStable<T>(elements: readonly T[], graine: string): T[] {
  const sortie = [...elements];
  const suivant = generateur(graineDe(graine));
  for (let i = sortie.length - 1; i > 0; i -= 1) {
    const j = Math.floor(suivant() * (i + 1));
    [sortie[i], sortie[j]] = [sortie[j]!, sortie[i]!];
  }
  return sortie;
}
