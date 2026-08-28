"use server";

import { createClient, getUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type TypeRendu = "texte" | "lien" | "fichier";

export type Devoir = {
  id: string;
  groupe_id: string;
  seance_id: string | null;
  module_id: string | null;
  titre: string;
  description: string | null;
  date_echeance: string | null;
  type_rendu: TypeRendu;
  moduleNom: string | null;
  /** Rendus enregistrés, du point de vue du formateur. */
  nbRendus: number;
  nbStagiaires: number;
};

export type MonRendu = {
  id: string;
  contenu: string | null;
  statut: "brouillon" | "rendu";
  date_rendu: string | null;
};

export type DevoirStagiaire = Omit<Devoir, "nbRendus" | "nbStagiaires"> & {
  monRendu: MonRendu | null;
};

/** Devoirs d'un groupe, vus par le formateur. */
export async function getDevoirsGroupe(groupeId: string): Promise<Devoir[]> {
  const supabase = await createClient();

  const [devoirsRes, stagiairesRes] = await Promise.all([
    supabase
      .from("devoirs")
      .select(
        "id, groupe_id, seance_id, module_id, titre, description, date_echeance, type_rendu, modules(nom), devoirs_rendus(id, statut)",
      )
      .eq("groupe_id", groupeId)
      .order("date_echeance", { nullsFirst: false }),
    supabase
      .from("stagiaires")
      .select("id", { count: "exact", head: true })
      .eq("groupe_id", groupeId),
  ]);

  if (devoirsRes.error) throw new Error(devoirsRes.error.message);

  const nbStagiaires = stagiairesRes.count ?? 0;

  return (
    devoirsRes.data as unknown as (Omit<
      Devoir,
      "moduleNom" | "nbRendus" | "nbStagiaires"
    > & {
      modules: { nom: string } | null;
      devoirs_rendus: { id: string; statut: string }[] | null;
    })[]
  ).map((d) => ({
    id: d.id,
    groupe_id: d.groupe_id,
    seance_id: d.seance_id,
    module_id: d.module_id,
    titre: d.titre,
    description: d.description,
    date_echeance: d.date_echeance,
    type_rendu: d.type_rendu,
    moduleNom: d.modules?.nom ?? null,
    // Un brouillon n'est pas un rendu : le stagiaire ne l'a pas remis.
    nbRendus: (d.devoirs_rendus ?? []).filter((r) => r.statut === "rendu").length,
    nbStagiaires,
  }));
}

/** Devoirs du stagiaire connecté, avec son propre rendu. */
export async function getMesDevoirs(): Promise<DevoirStagiaire[]> {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return [];

  const { data: moi } = await supabase
    .from("stagiaires")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!moi) return [];

  const { data, error } = await supabase
    .from("devoirs")
    .select(
      "id, groupe_id, seance_id, module_id, titre, description, date_echeance, type_rendu, modules(nom), devoirs_rendus(id, contenu, statut, date_rendu, stagiaire_id)",
    )
    .order("date_echeance", { nullsFirst: false });

  if (error) throw new Error(error.message);

  return (
    data as unknown as (Omit<DevoirStagiaire, "moduleNom" | "monRendu"> & {
      modules: { nom: string } | null;
      devoirs_rendus:
        | {
            id: string;
            contenu: string | null;
            statut: "brouillon" | "rendu";
            date_rendu: string | null;
            stagiaire_id: string;
          }[]
        | null;
    })[]
  ).map((d) => {
    // Les policies ne renvoient déjà que son propre rendu ; on filtre par
    // sécurité plutôt que de s'en remettre à l'ordre des lignes.
    const mien = (d.devoirs_rendus ?? []).find((r) => r.stagiaire_id === moi.id);
    return {
      id: d.id,
      groupe_id: d.groupe_id,
      seance_id: d.seance_id,
      module_id: d.module_id,
      titre: d.titre,
      description: d.description,
      date_echeance: d.date_echeance,
      type_rendu: d.type_rendu,
      moduleNom: d.modules?.nom ?? null,
      monRendu: mien
        ? {
            id: mien.id,
            contenu: mien.contenu,
            statut: mien.statut,
            date_rendu: mien.date_rendu,
          }
        : null,
    };
  });
}

export type SaisieDevoir = {
  groupeId: string;
  titre: string;
  description: string | null;
  dateEcheance: string | null;
  typeRendu: TypeRendu;
  moduleId: string | null;
  seanceId: string | null;
};

export async function creerDevoir(input: SaisieDevoir) {
  if (!input.titre.trim()) throw new Error("Le devoir a besoin d'un titre.");

  const supabase = await createClient();
  const { error } = await supabase.from("devoirs").insert({
    groupe_id: input.groupeId,
    titre: input.titre.trim(),
    description: input.description?.trim() || null,
    date_echeance: input.dateEcheance || null,
    type_rendu: input.typeRendu,
    module_id: input.moduleId,
    seance_id: input.seanceId,
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/groupes/${input.groupeId}/devoirs`);
}

export async function supprimerDevoir(id: string, groupeId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("devoirs").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/groupes/${groupeId}/devoirs`);
}

/**
 * Enregistre ou remet un rendu.
 *
 * Un brouillon reste modifiable ; une remise est datée et ne se reprend pas
 * depuis l'espace stagiaire — c'est ce qui distingue « j'y travaille » de
 * « je rends ».
 */
export async function enregistrerRendu(
  devoirId: string,
  contenu: string,
  remettre: boolean,
) {
  const user = await getUser();
  if (!user) throw new Error("Authentification requise.");

  const supabase = await createClient();
  const { data: moi } = await supabase
    .from("stagiaires")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!moi) throw new Error("Aucune fiche stagiaire pour ce compte.");

  if (remettre && !contenu.trim()) {
    throw new Error("Un devoir vide ne peut pas être remis.");
  }

  const { error } = await supabase.from("devoirs_rendus").upsert(
    {
      devoir_id: devoirId,
      stagiaire_id: moi.id,
      contenu: contenu.trim() || null,
      statut: remettre ? "rendu" : "brouillon",
      date_rendu: remettre ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "devoir_id,stagiaire_id" },
  );

  if (error) throw new Error(error.message);
  revalidatePath("/espace-stagiaire/devoirs");
}
