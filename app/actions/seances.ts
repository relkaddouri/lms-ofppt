"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type Seance = {
  id: string;
  groupe_id: string;
  module_id: string;
  date: string | null;
  contenu_prevu: string | null;
  contenu_realise: string | null;
  statut: "a_faire" | "fait";
  modules?: { nom: string } | null;
};

export async function getSeancesByGroupe(groupeId: string): Promise<Seance[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("seances")
    .select("*, modules(nom)")
    .eq("groupe_id", groupeId)
    .order("created_at");

  if (error) throw new Error(error.message);
  return data as Seance[];
}

export async function createSeancesForGroupe(groupeId: string) {
  const supabase = await createClient();

  const { data: assigned, error: errModules } = await supabase
    .from("groupe_modules")
    .select("module_id")
    .eq("groupe_id", groupeId);

  if (errModules) throw new Error(errModules.message);

  const { data: existing } = await supabase
    .from("seances")
    .select("id")
    .eq("groupe_id", groupeId);

  if (existing && existing.length > 0) {
    revalidatePath(`/groupes/${groupeId}/progression`);
    return;
  }

  if (assigned.length) {
    const { error } = await supabase.from("seances").insert(
      assigned.map((m) => ({
        groupe_id: groupeId,
        module_id: m.module_id,
        statut: "a_faire",
      })),
    );
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/groupes/${groupeId}/progression`);
}

export async function updateSeance(
  id: string,
  input: {
    contenu_realise?: string | null;
    statut?: "a_faire" | "fait";
  },
) {
  const supabase = await createClient();

  const update: Record<string, unknown> = {};
  if (input.contenu_realise !== undefined)
    update.contenu_realise = input.contenu_realise;
  if (input.statut) update.statut = input.statut;
  update.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("seances")
    .update(update)
    .eq("id", id)
    .select("groupe_id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath(`/groupes/${data.groupe_id}/progression`);
}
