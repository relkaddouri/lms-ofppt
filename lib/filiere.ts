/**
 * Le nom d'une filière, tel que les documents officiels l'écrivent.
 *
 * La spécialité seule ne suffit pas : le cahier du formateur, comme les procès
 * verbaux, nomment le cycle. « Digital Design » s'écrit « Digital Design -
 * Tronc Commun » en première année, et « Digital Design - Option UX designer »
 * en seconde.
 *
 * Le tronc commun se déduit de l'année. L'option, non : une filière en compte
 * plusieurs, et c'est le groupe qui en suit une (migration 115). Sans option
 * renseignée, « Spécialisation » reste vrai de toute deuxième année.
 */

export function libelleFiliere(
  specialite: string | null | undefined,
  annee: number | null | undefined,
  option?: string | null,
): string {
  const nom = specialite?.trim() || "—";
  if (annee === 1) return `${nom} - Tronc Commun`;
  if (annee === 2) {
    const o = option?.trim();
    return o ? `${nom} - Option ${o}` : `${nom} - Spécialisation`;
  }
  // Une année qu'on ne connaît pas : la spécialité seule, sans rien supposer.
  return nom;
}
