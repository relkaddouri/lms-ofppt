"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  proposerRepartition,
  arrondi,
  type ObjectifARepartir,
  type PartHoraire,
} from "@/lib/repartition";
import { construirePlan } from "@/lib/planification";

export type LigneRepartition = ObjectifARepartir & {
  elementsContenu: string | null;
  activites: string | null;
  presentiel: boolean;
  synchrone: boolean;
  asynchrone: boolean;
  heures_theoriques: number;
  heures_pratiques: number;
};

export type PlanificationModule = {
  groupeNom: string;
  moduleNom: string;
  competenceNom: string | null;
  codeOfficiel: string | null;
  dureeNationale: number | null;
  masseHoraire: number;
  pctTheorique: number;
  pctPratique: number;
  pctEvaluation: number;
  heuresEvaluation: number;
  lignes: LigneRepartition[];
  /** Vrai tant que le formateur n'a rien enregistré : ce qu'il voit est une proposition. */
  proposition: boolean;
};

type LigneSuggestion = {
  id: string;
  code: string | null;
  apprentissage_base: string;
  elements_contenu: string | null;
  activites_apprentissage: string | null;
  duree_suggeree_pourcent: number | null;
  presentiel: boolean;
  synchrone: boolean;
  asynchrone: boolean;
  ordre: number;
  elements_competence: { lettre: string; ordre: number } | null;
};

export async function getPlanification(
  groupeId: string,
  moduleId: string,
): Promise<PlanificationModule | null> {
  const supabase = await createClient();

  const { data: couple, error: errCouple } = await supabase
    .from("groupe_modules")
    .select(
      "masse_horaire_allouee, groupes(nom), modules(nom, competence_id, competences(nom, code_officiel, duree_nationale_heures, pct_theorique, pct_pratique, pct_evaluation))",
    )
    .eq("groupe_id", groupeId)
    .eq("module_id", moduleId)
    .maybeSingle();

  if (errCouple) throw new Error(errCouple.message);
  if (!couple) return null;

  const c = couple as unknown as {
    masse_horaire_allouee: number;
    groupes: { nom: string } | null;
    modules: {
      nom: string;
      competence_id: string | null;
      competences: {
        nom: string;
        code_officiel: string | null;
        duree_nationale_heures: number | null;
        pct_theorique: number | null;
        pct_pratique: number | null;
        pct_evaluation: number | null;
      } | null;
    } | null;
  };

  if (!c.modules?.competence_id) return null;

  const { data: sugg, error: errSugg } = await supabase
    .from("suggestions_pedagogiques")
    .select(
      "id, code, apprentissage_base, elements_contenu, activites_apprentissage, duree_suggeree_pourcent, presentiel, synchrone, asynchrone, ordre, elements_competence!inner(lettre, ordre, fiche_prescrite_id, fiches_prescrites!inner(competence_id))",
    )
    .eq(
      "elements_competence.fiches_prescrites.competence_id",
      c.modules.competence_id,
    );

  if (errSugg) throw new Error(errSugg.message);

  const objectifs = ((sugg ?? []) as unknown as LigneSuggestion[])
    .sort(
      (a, b) =>
        (a.elements_competence?.ordre ?? 0) - (b.elements_competence?.ordre ?? 0) ||
        a.ordre - b.ordre,
    )
    .map((s) => ({
      id: s.id,
      code: s.code ?? "—",
      intitule: s.apprentissage_base,
      lettre: s.elements_competence?.lettre ?? "?",
      pourcentElement: s.duree_suggeree_pourcent,
      elementsContenu: s.elements_contenu,
      activites: s.activites_apprentissage,
      presentiel: s.presentiel,
      synchrone: s.synchrone,
      asynchrone: s.asynchrone,
    }));

  const { data: existant, error: errRep } = await supabase
    .from("repartition_horaire")
    .select("suggestion_pedagogique_id, heures_theoriques, heures_pratiques")
    .eq("groupe_id", groupeId)
    .eq("module_id", moduleId);

  if (errRep) throw new Error(errRep.message);

  const comp = c.modules.competences;
  const pctT = Number(comp?.pct_theorique ?? 60);
  const pctP = Number(comp?.pct_pratique ?? 34);
  const pctE = Number(comp?.pct_evaluation ?? 6);
  const masse = Number(c.masse_horaire_allouee) || 0;

  const { parts, heuresEvaluation } = proposerRepartition(
    objectifs,
    masse,
    pctT,
    pctP,
    pctE,
  );

  const enregistre = new Map(
    (existant ?? []).map((r) => [
      r.suggestion_pedagogique_id,
      {
        t: Number(r.heures_theoriques),
        p: Number(r.heures_pratiques),
      },
    ]),
  );
  const propose = new Map(parts.map((p) => [p.suggestion_pedagogique_id, p]));

  return {
    groupeNom: c.groupes?.nom ?? "—",
    moduleNom: c.modules.nom,
    competenceNom: comp?.nom ?? null,
    codeOfficiel: comp?.code_officiel ?? null,
    dureeNationale: comp?.duree_nationale_heures ?? null,
    masseHoraire: masse,
    pctTheorique: pctT,
    pctPratique: pctP,
    pctEvaluation: pctE,
    heuresEvaluation,
    proposition: enregistre.size === 0,
    lignes: objectifs.map((o) => {
      const enr = enregistre.get(o.id);
      const pro = propose.get(o.id);
      return {
        ...o,
        heures_theoriques: enr?.t ?? pro?.heures_theoriques ?? 0,
        heures_pratiques: enr?.p ?? pro?.heures_pratiques ?? 0,
      };
    }),
  };
}

export async function saveRepartition(
  groupeId: string,
  moduleId: string,
  parts: PartHoraire[],
) {
  for (const p of parts) {
    if (p.heures_theoriques < 0 || p.heures_pratiques < 0) {
      throw new Error("Une durée ne peut pas être négative.");
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.from("repartition_horaire").upsert(
    parts.map((p) => ({
      groupe_id: groupeId,
      module_id: moduleId,
      suggestion_pedagogique_id: p.suggestion_pedagogique_id,
      heures_theoriques: arrondi(p.heures_theoriques),
      heures_pratiques: arrondi(p.heures_pratiques),
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "groupe_id,module_id,suggestion_pedagogique_id" },
  );

  if (error) throw new Error(error.message);
  revalidatePath(`/groupes/${groupeId}/modules/${moduleId}`);
}

export type ResultatPlan = {
  seancesCreees: number;
  controlesCrees: number;
  /** Déjà planifié : rien n'a été touché. */
  dejaPlanifie: boolean;
};

/**
 * Crée les séances et les contrôles du module à partir de la répartition.
 *
 * Volontairement, les fiches de préparation ne sont PAS générées : chaque
 * séance reçoit son objectif pédagogique, et le formateur déclenche lui-même
 * la génération quand il prépare cette séance-là.
 */
export async function genererPlanSeances(
  groupeId: string,
  moduleId: string,
  remplacer = false,
): Promise<ResultatPlan> {
  const supabase = await createClient();

  const { data: existantes, error: errEx } = await supabase
    .from("seances")
    .select("id, seance_groupes!inner(groupe_id)")
    .eq("seance_groupes.groupe_id", groupeId)
    .eq("module_id", moduleId)
    .not("suggestion_pedagogique_id", "is", null);
  if (errEx) throw new Error(errEx.message);

  if ((existantes ?? []).length > 0) {
    if (!remplacer) {
      return { seancesCreees: 0, controlesCrees: 0, dejaPlanifie: true };
    }
    // On ne supprime que les séances issues d'un plan, et seulement celles
    // qu'aucun travail n'a encore touchées : une séance déjà faite ou déjà
    // préparée n'est pas à la main du générateur.
    const { data: intactes } = await supabase
      .from("seances")
      .select("id, fiches_preparation(id), seance_groupes!inner(groupe_id)")
      .eq("seance_groupes.groupe_id", groupeId)
      .eq("module_id", moduleId)
      .eq("statut", "a_faire")
      .not("suggestion_pedagogique_id", "is", null);

    const supprimables = (
      (intactes ?? []) as unknown as { id: string; fiches_preparation: unknown[] }[]
    )
      .filter((s) => (s.fiches_preparation ?? []).length === 0)
      .map((s) => s.id);

    if (supprimables.length > 0) {
      const { error } = await supabase
        .from("seances")
        .delete()
        .in("id", supprimables);
      if (error) throw new Error(error.message);
    }
  }

  const plan = await getPlanification(groupeId, moduleId);
  if (!plan) throw new Error("Module introuvable pour ce groupe.");

  const { seances, controles } = construirePlan(
    plan.lignes.map((l) => ({
      id: l.id,
      code: l.code,
      intitule: l.intitule,
      heures_theoriques: l.heures_theoriques,
      heures_pratiques: l.heures_pratiques,
    })),
  );

  if (seances.length === 0) {
    throw new Error("La répartition ne contient aucune heure à planifier.");
  }

  const { data: creees, error: errSeances } = await supabase
    .from("seances")
    .insert(
      seances.map((s) => ({
        module_id: moduleId,
        suggestion_pedagogique_id: s.suggestion_pedagogique_id,
        nature: s.nature,
        duree_prevue: s.duree,
        statut: "a_faire",
        // L'objectif de la séance est celui du référentiel : c'est lui qui
        // fondera la fiche de préparation et le support.
        objectif_operationnel: `${s.code} — ${s.objectif}`,
      })),
    )
    .select("id");
  if (errSeances) throw new Error(errSeances.message);

  // Le plan produit des séances de présentiel : un seul groupe chacune. Le
  // partage FAD se déclare séance par séance, il ne se génère pas.
  const { error: errLiens } = await supabase.from("seance_groupes").insert(
    (creees ?? []).map((s) => ({ seance_id: s.id, groupe_id: groupeId })),
  );
  if (errLiens) throw new Error(errLiens.message);

  let controlesCrees = 0;
  if (controles.length > 0) {
    const { error: errControles } = await supabase.from("controles").insert(
      controles.map((c) => ({
        groupe_id: groupeId,
        module_id: moduleId,
        titre: `${c.libelle} — ${plan.moduleNom}`,
        type: "CC",
        format: "theorique",
        statut: "brouillon",
        duree_heures: 2,
      })),
    );
    if (errControles) throw new Error(errControles.message);
    controlesCrees = controles.length;
  }

  revalidatePath(`/groupes/${groupeId}/modules/${moduleId}`);
  revalidatePath(`/groupes/${groupeId}/progression`);

  return {
    seancesCreees: seances.length,
    controlesCrees,
    dejaPlanifie: false,
  };
}
