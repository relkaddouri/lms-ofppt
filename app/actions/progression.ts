"use server";

import { createClient } from "@/lib/supabase/server";

export type ProgressionModule = {
  groupe_id: string;
  module_id: string;
  masse_horaire_allouee: number;
  heures_realisees: number;
  nb_seances: number;
  nb_seances_faites: number;
  /** Séances marquées faites sans durée saisie : elles comptent pour 0 h. */
  nb_seances_sans_duree: number;
};

const COLONNES =
  "groupe_id, module_id, masse_horaire_allouee, heures_realisees, " +
  "nb_seances, nb_seances_faites, nb_seances_sans_duree";

function normalise(r: Record<string, unknown>): ProgressionModule {
  return {
    groupe_id: String(r.groupe_id),
    module_id: String(r.module_id),
    masse_horaire_allouee: Number(r.masse_horaire_allouee) || 0,
    heures_realisees: Number(r.heures_realisees) || 0,
    nb_seances: Number(r.nb_seances) || 0,
    nb_seances_faites: Number(r.nb_seances_faites) || 0,
    nb_seances_sans_duree: Number(r.nb_seances_sans_duree) || 0,
  };
}

/** Progression module par module pour un groupe. */
export async function getProgressionGroupe(
  groupeId: string,
): Promise<ProgressionModule[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_progression_module")
    .select(COLONNES)
    .eq("groupe_id", groupeId);

  if (error) throw new Error(error.message);
  // La vue n'est pas dans les types générés par Supabase, d'où le cast.
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(normalise);
}

/** Progression de tous les groupes accessibles, pour le tableau de bord. */
export async function getProgressionTousGroupes(): Promise<ProgressionModule[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_progression_module")
    .select(COLONNES);

  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(normalise);
}
