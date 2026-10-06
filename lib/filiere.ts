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
 * renseignée, la spécialité paraît seule : son nom la porte parfois déjà.
 */

export function libelleFiliere(
  specialite: string | null | undefined,
  annee: number | null | undefined,
  option?: string | null,
): string {
  const nom = specialite?.trim();
  const o = option?.trim();

  /*
    Un groupe de première année n'est pas tenu d'avoir une spécialité : la base
    ne l'exige qu'en deuxième. Sans elle, « Tronc Commun » se suffit — « — -
    Tronc Commun » ne dit rien et se lit comme une donnée manquante.
  */
  if (annee === 1) return nom ? `${nom} - Tronc Commun` : "Tronc Commun";

  if (annee === 2) {
    if (!nom) return o ? `Option ${o}` : "Spécialisation";
    /*
      Sans option déclarée, la spécialité seule. Lui ajouter « - Spécialisation »
      donnait « Digital Design - Option UX Design - Spécialisation » quand le nom
      de la spécialité portait déjà l'option.
    */
    return o ? `${nom} - Option ${o}` : nom;
  }

  // Une année qu'on ne connaît pas : la spécialité seule, sans rien supposer.
  return nom || "—";
}
