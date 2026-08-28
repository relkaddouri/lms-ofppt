"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type Groupe = {
  id: string;
  nom: string;
  date_debut: string | null;
  date_fin: string | null;
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
    await assignModulesToGroupe(data.id, input.module_ids);
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

/**
 * Aligne les modules d'un groupe sur `moduleIds`, sans toucher aux assignations
 * déjà en place : leur masse horaire allouée est une saisie du formateur, elle
 * ne doit jamais être perdue parce qu'un autre module a été coché ou décoché.
 * Une nouvelle assignation démarre sur la durée de référence du module.
 */
export async function assignModulesToGroupe(
  groupeId: string,
  moduleIds: string[],
) {
  const supabase = await createClient();

  const { data: existantes, error: errLect } = await supabase
    .from("groupe_modules")
    .select("module_id")
    .eq("groupe_id", groupeId);

  if (errLect) throw new Error(errLect.message);

  const dejaLa = new Set((existantes ?? []).map((r) => r.module_id));
  const aRetirer = [...dejaLa].filter((id) => !moduleIds.includes(id));
  const aAjouter = moduleIds.filter((id) => !dejaLa.has(id));

  if (aRetirer.length) {
    const { error } = await supabase
      .from("groupe_modules")
      .delete()
      .eq("groupe_id", groupeId)
      .in("module_id", aRetirer);
    if (error) throw new Error(error.message);
  }

  if (aAjouter.length) {
    const { data: modules, error: errModules } = await supabase
      .from("modules")
      .select("id, duree_reference")
      .in("id", aAjouter);

    if (errModules) throw new Error(errModules.message);

    const dureeParModule = new Map(
      (modules ?? []).map((m) => [m.id, Number(m.duree_reference) || 0]),
    );

    const { error } = await supabase.from("groupe_modules").insert(
      aAjouter.map((module_id) => ({
        groupe_id: groupeId,
        module_id,
        masse_horaire_allouee: dureeParModule.get(module_id) ?? 0,
      })),
    );
    if (error) throw new Error(error.message);
  }

  revalidatePath("/groupes");
  revalidatePath(`/groupes/${groupeId}`);
}

/** Masse horaire d'un couple groupe+module. Saisie par le formateur (atome 1.7). */
export async function setMasseHoraire(
  groupeId: string,
  moduleId: string,
  heures: number,
) {
  if (!Number.isFinite(heures) || heures < 0) {
    throw new Error("La masse horaire doit être un nombre positif.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("groupe_modules")
    .update({ masse_horaire_allouee: heures })
    .eq("groupe_id", groupeId)
    .eq("module_id", moduleId);

  if (error) throw new Error(error.message);

  revalidatePath(`/groupes/${groupeId}`);
}

export type GroupeModuleInfo = {
  module_id: string;
  nom: string;
  duree_reference: number;
  masse_horaire_allouee: number;
  code_operationnel: string | null;
  hasFiche: boolean;
  controleStatut: "brouillon" | "valide" | null;
};

export async function getGroupeModules(
  groupeId: string,
): Promise<GroupeModuleInfo[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("groupe_modules")
    .select(
      "module_id, masse_horaire_allouee, modules(nom, duree_reference, competences(code_operationnel))",
    )
    .eq("groupe_id", groupeId)
    .order("created_at");

  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const ids = rows.map((r) => r.module_id);

  const hasFiche = new Set<string>();
  const controleStatut = new Map<string, string>();

  if (ids.length) {
    const [fRes, cRes] = await Promise.all([
      // Une fiche est désormais rattachée à une séance : « ce module a une
      // fiche » se lit donc « une séance de ce module, dans ce groupe, en a
      // une ». Le filtre passe par la séance.
      supabase
        .from("fiches_preparation")
        .select("seances!inner(module_id, groupe_id)")
        .eq("seances.groupe_id", groupeId)
        .in("seances.module_id", ids),
      supabase
        .from("controles")
        .select("module_id, statut")
        .eq("groupe_id", groupeId)
        .in("module_id", ids)
        .order("created_at", { ascending: false }),
    ]);

    if (fRes.error) throw new Error(fRes.error.message);
    if (cRes.error) throw new Error(cRes.error.message);

    (
      fRes.data as unknown as { seances: { module_id: string } | null }[]
    ).forEach((r) => {
      if (r.seances?.module_id) hasFiche.add(r.seances.module_id);
    });
    cRes.data.forEach((r) => {
      if (!controleStatut.has(r.module_id)) {
        controleStatut.set(r.module_id, r.statut);
      }
    });
  }

  return rows.map((r) => {
    const mod = r.modules as {
      nom?: string;
      duree_reference?: number;
      competences?: { code_operationnel?: string | null } | null;
    } | null;
    return {
      module_id: r.module_id,
      nom: mod?.nom ?? "Module",
      duree_reference: Number(mod?.duree_reference) || 0,
      masse_horaire_allouee: Number(r.masse_horaire_allouee) || 0,
      code_operationnel: mod?.competences?.code_operationnel ?? null,
      hasFiche: hasFiche.has(r.module_id),
      controleStatut:
        (controleStatut.get(r.module_id) as "brouillon" | "valide") ?? null,
    };
  });
}
