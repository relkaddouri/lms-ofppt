/**
 * Reconnaître les colonnes de catégories dans un tableau markdown.
 *
 * Une colonne dont toutes les cellules tiennent en un mot court et se
 * répètent — « Quanti », « Quali », « Mixte » — est une colonne de
 * catégories. Le support de référence les pose en pastilles colorées : on les
 * compare alors d'un coup d'œil au lieu de les lire ligne à ligne.
 *
 * La détection vit ici, et non dans le composant, parce que l'écran et le PDF
 * doivent la faire pareil. Chacun garde en revanche sa palette : le premier
 * pose des classes, le second des triplets. Ce qui est partagé, c'est le rang
 * — la place de la valeur dans l'ordre d'apparition —, pas la couleur.
 */
export type Categories = {
  /** Index des colonnes à rendre en pastilles. */
  enPastille: Set<number>;
  /** Valeur normalisée → rang de couleur, dans l'ordre d'apparition. */
  rang: Map<string, number>;
};

export function colonnesCategorielles(
  lignes: string[][],
  nbColonnes: number,
): Categories {
  const enPastille = new Set<number>();
  const rang = new Map<string, number>();

  for (let c = 0; c < nbColonnes; c++) {
    const valeurs = lignes.map((l) => (l[c] ?? "").trim()).filter(Boolean);
    if (valeurs.length < 3) continue;
    if (!valeurs.every((v) => v.length <= 12 && !/\s/.test(v))) continue;
    // Des valeurs toutes différentes ne sont pas des catégories : ce sont des
    // données. Une catégorie se répète.
    const distinctes = [...new Set(valeurs)];
    if (distinctes.length > 4 || distinctes.length === valeurs.length) continue;
    enPastille.add(c);
    distinctes.forEach((v) => {
      if (!rang.has(v)) rang.set(v, rang.size);
    });
  }
  return { enPastille, rang };
}
