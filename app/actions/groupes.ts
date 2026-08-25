"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type Groupe = {
  id: string;
  nom: string;
  date_debut: string | null;
  date_fin: string | null;
  token_public: string;
  stagiaires?: { count: number }[];
};

export async function getGroupes(): Promise<Groupe[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("groupes")
    .select("*, stagiaires(count)")
    .order("date_debut", { ascending: true, nullsFirst: true });

  if (error) throw new Error(error.message);
  return data as Groupe[];
}

export async function getGroupeById(id: string): Promise<Groupe | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("groupes")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data as Groupe;
}

export async function createGroupe(input: {
  nom: string;
  date_debut?: string;
  date_fin?: string;
  module_ids?: string[];
}) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("groupes")
    .insert({
      nom: input.nom,
      date_debut: input.date_debut ?? null,
      date_fin: input.date_fin ?? null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  if (input.module_ids?.length) {
    const { error: errModules } = await supabase.from("groupe_modules").insert(
      input.module_ids.map((module_id) => ({
        groupe_id: data.id,
        module_id,
      })),
    );
    if (errModules) throw new Error(errModules.message);
  }

  revalidatePath("/groupes");
}

export async function updateGroupe(
  id: string,
  input: {
    nom: string;
    date_debut?: string;
    date_fin?: string;
    module_ids?: string[];
  },
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("groupes")
    .update({
      nom: input.nom,
      date_debut: input.date_debut ?? null,
      date_fin: input.date_fin ?? null,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  if (input.module_ids) {
    await assignModulesToGroupe(id, input.module_ids);
  }

  revalidatePath("/groupes");
}

export async function deleteGroupe(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("groupes").delete().eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/groupes");
}

export async function assignModulesToGroupe(
  groupeId: string,
  moduleIds: string[],
) {
  const supabase = await createClient();

  const { error: errDel } = await supabase
    .from("groupe_modules")
    .delete()
    .eq("groupe_id", groupeId);

  if (errDel) throw new Error(errDel.message);

  if (moduleIds.length) {
    const { error: errIns } = await supabase
      .from("groupe_modules")
      .insert(moduleIds.map((module_id) => ({ groupe_id: groupeId, module_id })));
    if (errIns) throw new Error(errIns.message);
  }

  revalidatePath("/groupes");
  revalidatePath(`/groupes/${groupeId}`);
}

export type GroupeModuleInfo = {
  module_id: string;
  nom: string;
  duree_heures: number;
  hasFiche: boolean;
  controleStatut: "brouillon" | "valide" | null;
};

export async function getGroupeModules(
  groupeId: string,
): Promise<GroupeModuleInfo[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("groupe_modules")
    .select("module_id, modules(nom, duree_heures)")
    .eq("groupe_id", groupeId)
    .order("created_at");

  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const ids = rows.map((r) => r.module_id);

  const hasFiche = new Set<string>();
  const controleStatut = new Map<string, string>();

  if (ids.length) {
    const [fRes, cRes] = await Promise.all([
      supabase
        .from("fiches_preparation")
        .select("module_id")
        .in("module_id", ids),
      supabase
        .from("controles")
        .select("module_id, statut")
        .in("module_id", ids)
        .order("created_at", { ascending: false }),
    ]);

    if (fRes.error) throw new Error(fRes.error.message);
    if (cRes.error) throw new Error(cRes.error.message);

    fRes.data.forEach((r) => hasFiche.add(r.module_id));
    cRes.data.forEach((r) => {
      if (!controleStatut.has(r.module_id)) {
        controleStatut.set(r.module_id, r.statut);
      }
    });
  }

  return rows.map((r) => {
    const mod = r.modules as { nom?: string; duree_heures?: number } | null;
    return {
      module_id: r.module_id,
      nom: mod?.nom ?? "Module",
      duree_heures: Number(mod?.duree_heures) || 0,
      hasFiche: hasFiche.has(r.module_id),
      controleStatut:
        (controleStatut.get(r.module_id) as "brouillon" | "valide") ?? null,
    };
  });
}
