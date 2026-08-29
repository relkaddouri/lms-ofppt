"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type Module = {
  id: string;
  nom: string;
  description: string | null;
  duree_reference: number;
  /** Code court de la compétence, celui avec lequel le formateur pense. */
  code: string | null;
  /** Nombre de groupes auxquels le module est assigné. */
  groupes: number;
};

export async function getModules(): Promise<Module[]> {
  const supabase = await createClient();

  // Colonnes explicites plutôt que `*` (conventions.md), et le code
  // opérationnel de la compétence, qui est ce que le formateur lit en premier.
  const [modulesRes, assignationsRes] = await Promise.all([
    supabase
      .from("modules")
      .select(
        "id, nom, description, duree_reference, competences(code_operationnel)",
      )
      .order("nom"),
    supabase.from("groupe_modules").select("module_id"),
  ]);

  if (modulesRes.error) throw new Error(modulesRes.error.message);
  if (assignationsRes.error) throw new Error(assignationsRes.error.message);

  const parModule = new Map<string, number>();
  for (const a of assignationsRes.data ?? []) {
    const id = a.module_id as string;
    parModule.set(id, (parModule.get(id) ?? 0) + 1);
  }

  return (modulesRes.data ?? []).map((m) => {
    const r = m as unknown as {
      id: string;
      nom: string;
      description: string | null;
      duree_reference: number;
      competences: { code_operationnel: string | null } | null;
    };
    return {
      id: r.id,
      nom: r.nom,
      description: r.description,
      duree_reference: r.duree_reference,
      code: r.competences?.code_operationnel ?? null,
      groupes: parModule.get(r.id) ?? 0,
    };
  });
}

export type ModuleControleInfo = {
  id: string;
  titre: string | null;
  statut: "brouillon" | "valide";
};

/** Compétence du référentiel dont le module est la déclinaison opérationnelle. */
export type CompetenceLiee = {
  numero: number;
  code_operationnel: string | null;
  /** Valeur officielle du programme. Jamais modifiée localement. */
  duree_nationale_heures: number | null;
};

export type ModuleDetail = {
  module: Module;
  competence: CompetenceLiee | null;
  controles: ModuleControleInfo[];
  hasFiche: boolean;
  groupes: { id: string; nom: string }[];
};

export async function getModuleDetail(moduleId: string): Promise<ModuleDetail | null> {
  const supabase = await createClient();

  const [mod, fiche, groupes, controles] = await Promise.all([
    supabase
      .from("modules")
      .select(
        "*, competences(numero, code_operationnel, duree_nationale_heures)",
      )
      .eq("id", moduleId)
      .single(),
    supabase
      .from("fiches_preparation")
      .select("id, seances!inner(module_id)", { count: "exact", head: true })
      .eq("seances.module_id", moduleId),
    supabase
      .from("groupe_modules")
      .select("groupes(id, nom)")
      .eq("module_id", moduleId)
      .order("created_at"),
    supabase
      .from("controles")
      .select("id, titre, statut")
      .eq("module_id", moduleId)
      .order("created_at", { ascending: false }),
  ]);

  if (mod.error || !mod.data) return null;
  if (fiche.error) throw new Error(fiche.error.message);
  if (groupes.error) throw new Error(groupes.error.message);
  if (controles.error) throw new Error(controles.error.message);

  const brut = mod.data as Module & { competences?: CompetenceLiee | null };

  return {
    module: brut,
    competence: brut.competences ?? null,
    hasFiche: (fiche.count ?? 0) > 0,
    groupes: (groupes.data ?? []).map((g) => {
      const raw = Array.isArray(g.groupes) ? g.groupes[0] : g.groupes;
      const gr = raw as { id: string; nom: string } | null;
      return { id: gr?.id ?? "", nom: gr?.nom ?? "Groupe" };
    }),
    controles: (controles.data ?? []) as ModuleControleInfo[],
  };
}

export async function createModule(input: {
  nom: string;
  description?: string | null;
  duree_reference: number;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("modules").insert({
    nom: input.nom,
    description: input.description ?? null,
    duree_reference: input.duree_reference,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/modules");
}

export async function updateModule(
  id: string,
  input: {
    nom: string;
    description?: string | null;
    duree_reference: number;
  },
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("modules")
    .update({
      nom: input.nom,
      description: input.description ?? null,
      duree_reference: input.duree_reference,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/modules");
}

/**
 * Ajuste la durée de référence d'un module. Ce n'est qu'un repère local :
 * la durée officielle du programme reste celle de la compétence, et les masses
 * horaires déjà allouées par groupe ne sont pas touchées.
 */
export async function setDureeReference(moduleId: string, heures: number) {
  if (!Number.isFinite(heures) || heures < 0) {
    throw new Error("La durée de référence doit être un nombre positif.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("modules")
    .update({ duree_reference: heures })
    .eq("id", moduleId);

  if (error) throw new Error(error.message);

  revalidatePath("/modules");
  revalidatePath(`/modules/${moduleId}`);
}

export async function deleteModule(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("modules").delete().eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/modules");
}
