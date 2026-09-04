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
): Promise<{
  correction: CorrectionTp;
  version: number;
  partagee: boolean;
} | null> {
  const supabase = await createClient();
  const source = await sourceContenu(seanceId);

  const { data, error } = await supabase
    .from("corrections_tp")
    .select("contenu, version, partagee_avec_stagiaires")
    .eq("seance_id", source)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    correction: lireCorrection(data.contenu),
    version: data.version,
    partagee: data.partagee_avec_stagiaires,
  };
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

/**
 * Ouvre ou ferme la correction aux stagiaires du groupe (PRD §4.4).
 *
 * La décision est prise correction par correction, jamais pour un module
 * entier : le formateur peut vouloir partager un TP et garder le suivant.
 *
 * Fermer bloque les accès à venir. Ça n'annule pas ce qu'un stagiaire a déjà
 * lu ou téléchargé, et l'écran le dit — laisser croire à un retrait
 * rétroactif serait une fausse sécurité.
 */
export async function partagerCorrection(
  seanceId: string,
  partagee: boolean,
): Promise<boolean> {
  const supabase = await createClient();
  const source = await sourceContenu(seanceId);

  // La dernière version fait foi : c'est celle que l'écran affiche, et donc
  // celle que le formateur croit partager.
  const { data: derniere } = await supabase
    .from("corrections_tp")
    .select("id")
    .eq("seance_id", source)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!derniere) throw new Error("Aucune correction à partager.");

  const { error } = await supabase
    .from("corrections_tp")
    .update({ partagee_avec_stagiaires: partagee })
    .eq("id", derniere.id);
  if (error) throw new Error(error.message);

  revalidatePath("/groupes", "layout");
  revalidatePath("/espace-stagiaire", "layout");
  return partagee;
}
