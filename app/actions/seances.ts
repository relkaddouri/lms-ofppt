"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  creneauDe,
  dureeHeures,
  type BlocHoraire,
  type PartieBloc,
} from "@/lib/creneaux";

export type ModeSeance = "presentiel" | "distance";

export type Seance = {
  id: string;
  groupe_id: string;
  module_id: string;
  date: string | null;
  heure_debut: string | null;
  heure_fin: string | null;
  mode: ModeSeance | null;
  objectif_operationnel: string | null;
  contenu_prevu: string | null;
  contenu_realise: string | null;
  duree_realisee: number | null;
  a_prevoir_prochaine_seance: string | null;
  statut: "a_faire" | "fait";
  duree_prevue: number | null;
  nature: "theorique" | "pratique" | null;
  suggestion_pedagogique_id: string | null;
  modules?: { nom: string } | null;
  /** Objectif d'apprentissage du référentiel, quand la séance vient du plan. */
  suggestions_pedagogiques?: { code: string | null; apprentissage_base: string } | null;
};

const COLONNES =
  "id, groupe_id, module_id, date, heure_debut, heure_fin, mode, " +
  "objectif_operationnel, contenu_prevu, contenu_realise, duree_realisee, " +
  "a_prevoir_prochaine_seance, statut, duree_prevue, nature, " +
  "suggestion_pedagogique_id, modules(nom), " +
  "suggestions_pedagogiques(code, apprentissage_base)";

export async function getSeancesByGroupe(groupeId: string): Promise<Seance[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("seances")
    .select(COLONNES)
    .eq("groupe_id", groupeId)
    // Les séances issues du plan n'ont pas encore de date : elles se lisent
    // dans l'ordre où elles ont été posées, qui est celui du référentiel.
    .order("date", { ascending: true, nullsFirst: false })
    .order("heure_debut", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Seance[];
}

export type NouvelleSeance = {
  groupeId: string;
  moduleId: string;
  date: string;
  /** Bloc de demi-journée, éventuellement scindé. */
  bloc: BlocHoraire;
  partie: PartieBloc;
  mode: ModeSeance;
  objectifOperationnel?: string;
  contenuPrevu?: string;
};

/**
 * Crée UNE séance, à tout moment.
 *
 * Remplace l'ancienne `createSeancesForGroupe`, qui générait une séance par
 * module au premier appel puis refusait tout appel suivant : un module ajouté
 * plus tard n'obtenait jamais de séance, et il était impossible d'en planifier
 * plusieurs sur un même couple groupe+module.
 */
export async function createSeance(input: NouvelleSeance): Promise<string> {
  if (!input.date) throw new Error("La date de la séance est requise.");

  const creneau = creneauDe(input.bloc, input.partie);
  const duree = dureeHeures(creneau.debut, creneau.fin);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("seances")
    .insert({
      groupe_id: input.groupeId,
      module_id: input.moduleId,
      date: input.date,
      heure_debut: creneau.debut,
      heure_fin: creneau.fin,
      mode: input.mode,
      objectif_operationnel: input.objectifOperationnel?.trim() || null,
      contenu_prevu: input.contenuPrevu?.trim() || null,
      // Prérempli sur la durée du créneau ; ajustable une fois la séance faite.
      duree_realisee: duree,
      statut: "a_faire",
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath(`/groupes/${input.groupeId}/progression`);
  return data.id;
}

export async function updateSeance(
  id: string,
  input: {
    contenu_realise?: string | null;
    objectif_operationnel?: string | null;
    a_prevoir_prochaine_seance?: string | null;
    duree_realisee?: number | null;
    statut?: "a_faire" | "fait";
  },
) {
  if (
    input.duree_realisee !== undefined &&
    input.duree_realisee !== null &&
    (!Number.isFinite(input.duree_realisee) || input.duree_realisee < 0)
  ) {
    throw new Error("La durée réalisée doit être un nombre positif.");
  }

  const supabase = await createClient();

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const cle of [
    "contenu_realise",
    "objectif_operationnel",
    "a_prevoir_prochaine_seance",
    "duree_realisee",
  ] as const) {
    if (input[cle] !== undefined) update[cle] = input[cle];
  }
  if (input.statut) update.statut = input.statut;

  const { data, error } = await supabase
    .from("seances")
    .update(update)
    .eq("id", id)
    .select("groupe_id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath(`/groupes/${data.groupe_id}/progression`);
}

export async function deleteSeance(id: string, groupeId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("seances").delete().eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath(`/groupes/${groupeId}/progression`);
}
