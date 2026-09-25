/**
 * Ce qu'une séance couvre, tel que le stagiaire doit le lire (PRD §4.5bis).
 *
 * L'intitulé d'une séance est composé pour le formateur : les codes du
 * référentiel, la nature de chaque élément, le tout sur une ligne —
 * « C.2 — Trouver des solutions techniques — pratique · D.1 — Créer des
 * personas — theorique · … ». Affiché tel quel dans l'emploi du temps, il
 * donnait un titre de quatre lignes où rien ne se lisait.
 *
 * On le redécoupe donc en éléments : le premier fait le titre, les autres se
 * lisent dessous. La nature n'y est pas reprise — l'étiquette de la carte la
 * porte déjà.
 */

const NATURE = / — (th[ée]orique|pratique)\s*$/i;
const CODE = /^([A-Z]\.\d+)\s+—\s+(.+)$/;

export type ElementSeance = {
  /** Le code du référentiel, « A.1 », quand l'intitulé le porte. */
  code: string | null;
  intitule: string;
};

export function elementsDeSeance(
  intitule: string | null | undefined,
): ElementSeance[] {
  if (!intitule?.trim()) return [];

  const vus = new Set<string>();
  const elements: ElementSeance[] = [];

  for (const brut of intitule.split(" · ")) {
    // Les natures empilées par d'anciens recalculs se retirent l'une après
    // l'autre : « … — theorique — theorique » ne dit rien de plus.
    let segment = brut.trim();
    while (NATURE.test(segment)) segment = segment.replace(NATURE, "").trim();
    if (!segment) continue;

    const trouve = CODE.exec(segment);
    const element = trouve
      ? { code: trouve[1]!, intitule: trouve[2]!.trim() }
      : { code: null, intitule: segment };

    const cle = `${element.code ?? ""}|${element.intitule.toLowerCase()}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    elements.push(element);
  }

  return elements;
}
