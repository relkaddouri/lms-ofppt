"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type Stagiaire = {
  id: string;
  nom: string;
  prenom: string;
  email: string | null;
  /** Code d'Enregistrement du Formé — l'identifiant OFPPT du stagiaire. */
  cef: string | null;
  groupe_id: string;
  /** Compte du stagiaire ; nul tant qu'il n'a pas été invité. */
  user_id: string | null;
};

export async function getStagiairesByGroupe(
  groupeId: string,
): Promise<Stagiaire[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stagiaires")
    .select("id, nom, prenom, email, cef, groupe_id, user_id")
    .eq("groupe_id", groupeId)
    .order("nom");

  if (error) throw new Error(error.message);
  return data as Stagiaire[];
}

export async function getStagiairesCount(groupeId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("stagiaires")
    .select("id", { count: "exact", head: true })
    .eq("groupe_id", groupeId);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Le CEF est unique : un doublon mérite mieux qu'un message de Postgres. */
function messageCef(message: string): string {
  return message.includes("stagiaires_cef_unique")
    ? "Ce CEF est déjà attribué à un autre stagiaire."
    : message;
}

export async function addStagiaire(
  groupeId: string,
  input: { nom: string; prenom: string; email?: string; cef?: string },
) {
  const supabase = await createClient();
  const { error } = await supabase.from("stagiaires").insert({
    groupe_id: groupeId,
    nom: input.nom,
    prenom: input.prenom,
    email: input.email?.trim() || null,
    cef: input.cef?.trim() || null,
  });

  if (error) throw new Error(messageCef(error.message));
  revalidatePath(`/groupes/${groupeId}`);
}

export async function updateStagiaire(
  id: string,
  groupeId: string,
  input: { nom: string; prenom: string; email?: string; cef?: string },
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("stagiaires")
    .update({
      nom: input.nom,
      prenom: input.prenom,
      email: input.email?.trim() || null,
      cef: input.cef?.trim() || null,
    })
    .eq("id", id);

  if (error) throw new Error(messageCef(error.message));
  revalidatePath(`/groupes/${groupeId}`);
}

export async function removeStagiaire(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("stagiaires").delete().eq("id", id);

  if (error) throw new Error(error.message);
}

export type StagiaireImportRow = {
  nom: string;
  prenom: string;
  email: string | null;
  cef: string | null;
};

export async function bulkImportStagiaires(
  groupeId: string,
  rows: StagiaireImportRow[],
): Promise<{ imported: number }> {
  const supabase = await createClient();

  if (!rows.length) return { imported: 0 };

  const { error } = await supabase.from("stagiaires").insert(
    rows.map((row) => ({
      groupe_id: groupeId,
      nom: row.nom,
      prenom: row.prenom,
      email: row.email ?? null,
      cef: row.cef ?? null,
    })),
  );

  if (error) throw new Error(error.message);
  revalidatePath(`/groupes/${groupeId}`);
  return { imported: rows.length };
}
