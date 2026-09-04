"use server";

import { createClient } from "@/lib/supabase/server";
import { libelleModule } from "@/lib/modules";
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
  /** Dix heures fixes : deux contrôles continus et une épreuve de fin de module. */
  heuresEvaluation: number;
  /** Ce qui ne tient dans aucun bloc de 2 h 30, quand la masse n'en est pas un multiple. */
  heuresNonPlacables: number;
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
      "masse_horaire_allouee, groupes(nom), modules(nom, competence_id, competences(nom, code_officiel, code_operationnel, duree_nationale_heures, pct_theorique, pct_pratique, pct_evaluation))",
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
        code_operationnel: string | null;
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
  const masse = Number(c.masse_horaire_allouee) || 0;

  // Le temps d'évaluation ne se déduit plus d'un pourcentage : il est fixe et
  // réservé avant tout partage (PRD §4.7).
  const { parts, heuresEvaluation, heuresNonPlacables } = proposerRepartition(
    objectifs,
    masse,
    pctT,
    pctP,
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
    moduleNom: libelleModule(
      c.modules.competences?.code_operationnel,
      c.modules.nom,
    ),
    competenceNom: comp?.nom ?? null,
    codeOfficiel: comp?.code_officiel ?? null,
    dureeNationale: comp?.duree_nationale_heures ?? null,
    masseHoraire: masse,
    pctTheorique: pctT,
    pctPratique: pctP,
    heuresEvaluation,
    heuresNonPlacables,
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
      .select(
        "id, contenu_source_id, fiches_preparation(id), seance_groupes!inner(groupe_id)",
      )
      .eq("seance_groupes.groupe_id", groupeId)
      .eq("module_id", moduleId)
      .eq("statut", "a_faire")
      .not("suggestion_pedagogique_id", "is", null);

    // §4.3bis : une séance miroir n'a pas de fiche à elle — elle affiche
    // celle de sa source. La compter comme « sans fiche » la supprimerait
    // alors que le formateur l'a explicitement rattachée.
    const supprimables = (
      (intactes ?? []) as unknown as {
        id: string;
        contenu_source_id: string | null;
        fiches_preparation: unknown[];
      }[]
    )
      .filter(
        (s) =>
          (s.fiches_preparation ?? []).length === 0 && !s.contenu_source_id,
      )
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
    .select("id, suggestion_pedagogique_id");
  if (errSeances) throw new Error(errSeances.message);

  // Le plan produit des séances de présentiel : un seul groupe chacune. Le
  // partage FAD se déclare séance par séance, il ne se génère pas.
  const { error: errLiens } = await supabase.from("seance_groupes").insert(
    (creees ?? []).map((s) => ({ seance_id: s.id, groupe_id: groupeId })),
  );
  if (errLiens) throw new Error(errLiens.message);

  const elementsRepartis = await repartirElementsContenu(supabase, creees ?? []);

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

/**
 * Répartit les éléments de contenu du référentiel sur les séances générées.
 *
 * PRD §4.2bis : l'EFF national porte sur ce référentiel, donc chaque élément
 * doit avoir été traité. Une séance ne reçoit pas l'apprentissage entier mais
 * une part précise et non chevauchante de sa liste — l'ensemble des séances
 * d'un apprentissage couvre 100 %% de ses éléments, sans doublon ni oubli.
 *
 * Les parts sont contiguës et suivent l'ordre du référentiel : les six
 * éléments de A.1 sur deux séances donnent 1-3 puis 4-6, pas un panachage.
 * Un apprentissage qui a moins d'éléments que de séances en laisse certaines
 * sans élément propre — c'est le référentiel qui est ainsi, pas un oubli.
 */
async function repartirElementsContenu(
  supabase: Awaited<ReturnType<typeof createClient>>,
  seances: { id: string; suggestion_pedagogique_id: string | null }[],
): Promise<number> {
  const parApprentissage = new Map<string, string[]>();
  for (const s of seances) {
    if (!s.suggestion_pedagogique_id) continue;
    const liste = parApprentissage.get(s.suggestion_pedagogique_id) ?? [];
    liste.push(s.id);
    parApprentissage.set(s.suggestion_pedagogique_id, liste);
  }
  if (parApprentissage.size === 0) return 0;

  const { data: elements, error } = await supabase
    .from("elements_contenu")
    .select("id, suggestion_pedagogique_id, ordre")
    .in("suggestion_pedagogique_id", [...parApprentissage.keys()])
    .order("ordre");
  if (error) throw new Error(error.message);

  const liens: { seance_id: string; element_contenu_id: string }[] = [];
  for (const [suggestionId, seanceIds] of parApprentissage) {
    const propres = (elements ?? []).filter(
      (e) => e.suggestion_pedagogique_id === suggestionId,
    );
    if (propres.length === 0) continue;

    // Parts contiguës : les premières séances prennent le reste de la
    // division, pour que l'écart entre elles ne dépasse jamais un élément.
    const base = Math.floor(propres.length / seanceIds.length);
    const reste = propres.length % seanceIds.length;
    let curseur = 0;
    for (let i = 0; i < seanceIds.length; i += 1) {
      const combien = base + (i < reste ? 1 : 0);
      for (const e of propres.slice(curseur, curseur + combien)) {
        liens.push({ seance_id: seanceIds[i]!, element_contenu_id: e.id });
      }
      curseur += combien;
    }
  }

  if (liens.length === 0) return 0;
  const { error: errLiens } = await supabase
    .from("seance_elements_contenu")
    .insert(liens);
  if (errLiens) throw new Error(errLiens.message);
  return liens.length;
}
