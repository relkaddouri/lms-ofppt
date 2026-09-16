"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Les notes privées du formateur sur une séance (PRD §4.7bis, migration 088).
 *
 * Séparées du contenu réalisé, qui part au classeur, se lit côté stagiaire et
 * nourrit la génération des contrôles. Une note d'organisation — « l'heure
 * dédiée à l'année de spécialisation » — glissée là était devenue une question
 * de contrôle. Ici, aucun générateur ne lit, aucun stagiaire ne voit : la
 * politique RLS ne s'ouvre qu'au formateur du groupe.
 */

export async function getNotesSeance(seanceId: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notes_seance")
    .select("texte")
    .eq("seance_id", seanceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.texte ?? "";
}

export async function enregistrerNotesSeance(
  seanceId: string,
  texte: string,
): Promise<void> {
  if (texte.length > 20000) {
    throw new Error("Notes trop longues (20 000 caractères au plus).");
  }
  const supabase = await createClient();
  const { error } = await supabase.from("notes_seance").upsert(
    { seance_id: seanceId, texte, updated_at: new Date().toISOString() },
    { onConflict: "seance_id" },
  );
  if (error) throw new Error(error.message);
}
