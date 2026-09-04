"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { sourceContenu } from "@/app/actions/partage";
import { lireCorrection, type CorrectionTp } from "@/lib/correction";

/**
 * Corrections de travaux pratiques (PRD §4.4).
 *
 * Deux garde-fous sont en base — la séance doit être pratique et faite, et
 * aucun stagiaire n'a de politique de lecture. Ce fichier ne les redouble pas,
 * il s'appuie dessus : une règle vérifiée à deux endroits finit par diverger.
 */

/**
 * La dernière correction d'un TP, s'il en existe une.
 *
 * Comme la fiche et le support, elle suit la séance qui porte le contenu :
 * deux groupes parallèles font le même TP, sa correction n'a pas à être
 * écrite deux fois (§4.3bis).
 */
export async function getCorrection(
  seanceId: string,
): Promise<{ correction: CorrectionTp; version: number } | null> {
  const supabase = await createClient();
  const source = await sourceContenu(seanceId);

  const { data, error } = await supabase
    .from("corrections_tp")
    .select("contenu, version")
    .eq("seance_id", source)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return { correction: lireCorrection(data.contenu), version: data.version };
}

/** Enregistre une correction en créant une nouvelle version. */
export async function saveCorrection(
  seanceId: string,
  correction: CorrectionTp,
): Promise<number> {
  const supabase = await createClient();
  const source = await sourceContenu(seanceId);

  const { data: derniere } = await supabase
    .from("corrections_tp")
    .select("version")
    .eq("seance_id", source)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const version = (derniere?.version ?? 0) + 1;
  const { error } = await supabase
    .from("corrections_tp")
    .insert({ seance_id: source, contenu: correction, version });
  if (error) throw new Error(error.message);

  revalidatePath("/groupes", "layout");
  return version;
}
