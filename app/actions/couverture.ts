"use server";

import { createClient } from "@/lib/supabase/server";

export type ElementCouvert = {
  id: string;
  intitule: string;
  ordre: number;
  /** Séance à laquelle l'élément est assigné, s'il l'est. */
  seanceId: string | null;
  seanceDate: string | null;
  /** L'élément a été traité : sa séance est marquée faite. */
  traite: boolean;
};

export type ApprentissageCouvert = {
  suggestionId: string;
  code: string | null;
  intitule: string;
  elementCompetence: string | null;
  elements: ElementCouvert[];
};

export type CouvertureModule = {
  apprentissages: ApprentissageCouvert[];
  total: number;
  assignes: number;
  traites: number;
};

/**
 * Couverture du référentiel pour un couple groupe+module (PRD §4.2bis).
 *
 * L'écran de progression répond à « combien d'heures ai-je dispensées ». Il ne
 * répondait pas à « ai-je traité tout ce sur quoi l'EFF va porter ». Ce sont
 * deux questions différentes : on peut avoir consommé sa masse horaire en
 * laissant trois éléments de contenu de côté.
 */
export async function getCouvertureModule(
  groupeId: string,
  moduleId: string,
): Promise<CouvertureModule> {
  const supabase = await createClient();

  // La compétence dont ce module est la déclinaison porte les apprentissages,
  // et les apprentissages portent les éléments de contenu.
  const { data: mod, error: errMod } = await supabase
    .from("modules")
    .select("competence_id")
    .eq("id", moduleId)
    .maybeSingle();
  if (errMod) throw new Error(errMod.message);
  if (!mod?.competence_id) {
    return { apprentissages: [], total: 0, assignes: 0, traites: 0 };
  }

  const [suggestionsRes, seancesRes] = await Promise.all([
    supabase
      .from("suggestions_pedagogiques")
      .select(
        // La chaîne du référentiel : compétence → fiche prescrite → élément
        // de compétence → apprentissage → éléments de contenu.
        "id, code, apprentissage_base, ordre, elements_competence!inner(lettre, fiches_prescrites!inner(competence_id)), elements_contenu(id, intitule, ordre)",
      )
      .eq(
        "elements_competence.fiches_prescrites.competence_id",
        mod.competence_id,
      )
      .order("ordre"),
    supabase
      .from("seances")
      .select(
        "id, date, statut, seance_groupes!inner(groupe_id), seance_elements_contenu(element_contenu_id)",
      )
      .eq("module_id", moduleId)
      .eq("seance_groupes.groupe_id", groupeId),
  ]);

  if (suggestionsRes.error) throw new Error(suggestionsRes.error.message);
  if (seancesRes.error) throw new Error(seancesRes.error.message);

  // Un élément n'est assigné qu'à une séance : la répartition est non
  // chevauchante par construction.
  const parElement = new Map<
    string,
    { seanceId: string; date: string | null; fait: boolean }
  >();
  for (const s of seancesRes.data ?? []) {
    const r = s as unknown as {
      id: string;
      date: string | null;
      statut: string;
      seance_elements_contenu: { element_contenu_id: string }[];
    };
    for (const lien of r.seance_elements_contenu ?? []) {
      parElement.set(lien.element_contenu_id, {
        seanceId: r.id,
        date: r.date,
        fait: r.statut === "fait",
      });
    }
  }

  let total = 0;
  let assignes = 0;
  let traites = 0;

  const apprentissages: ApprentissageCouvert[] = (suggestionsRes.data ?? []).map(
    (s) => {
      const r = s as unknown as {
        id: string;
        code: string | null;
        apprentissage_base: string;
        elements_competence: { lettre: string | null } | null;
        elements_contenu: { id: string; intitule: string; ordre: number }[];
      };
      const elements = (r.elements_contenu ?? [])
        .sort((a, b) => a.ordre - b.ordre)
        .map((e) => {
          const pose = parElement.get(e.id);
          total += 1;
          if (pose) assignes += 1;
          if (pose?.fait) traites += 1;
          return {
            id: e.id,
            intitule: e.intitule,
            ordre: e.ordre,
            seanceId: pose?.seanceId ?? null,
            seanceDate: pose?.date ?? null,
            traite: Boolean(pose?.fait),
          };
        });

      return {
        suggestionId: r.id,
        code: r.code,
        intitule: r.apprentissage_base,
        elementCompetence: r.elements_competence?.lettre ?? null,
        elements,
      };
    },
  );

  return { apprentissages, total, assignes, traites };
}

/**
 * Éléments de contenu assignés à une séance.
 *
 * C'est ce que la fiche de préparation doit traiter — pas l'apprentissage
 * entier, dont la séance ne couvre qu'une part.
 */
export async function getElementsDeSeance(
  seanceId: string,
): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("seance_elements_contenu")
    .select("elements_contenu(intitule, ordre)")
    .eq("seance_id", seanceId);

  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((r) => (r as unknown as { elements_contenu: { intitule: string; ordre: number } | null }).elements_contenu)
    .filter((e): e is { intitule: string; ordre: number } => e !== null)
    .sort((a, b) => a.ordre - b.ordre)
    .map((e) => e.intitule);
}
