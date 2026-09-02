"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type FichePreparation = {
  id: string;
  seance_id: string;
  contenu: string | null;
  version: number;
  created_at: string;
};

/** Séance telle qu'affichée dans le sélecteur de fiche. */
export type SeanceAPreparer = {
  id: string;
  date: string | null;
  heure_debut: string | null;
  heure_fin: string | null;
  statut: string;
  objectif_operationnel: string | null;
  contenu_prevu: string | null;
  contenu_realise: string | null;
  groupe_id: string;
  groupe_nom: string;
  /** Pour l'en-tête du formulaire officiel. */
  groupe_annee: number | null;
  filiere: string;
  /** Nombre de versions de fiche déjà enregistrées pour cette séance. */
  nb_versions: number;
};

/**
 * Séances d'un module, éventuellement restreintes à un groupe.
 *
 * Une fiche prépare une séance : le formateur choisit donc d'abord la séance,
 * et non plus le module dans son ensemble.
 */
export async function getSeancesAPreparer(
  moduleId: string,
  groupeId?: string,
): Promise<SeanceAPreparer[]> {
  const supabase = await createClient();

  let query = supabase
    .from("seances")
    .select(
      "id, date, heure_debut, heure_fin, statut, objectif_operationnel, contenu_prevu, contenu_realise, groupe_id, groupes(nom, annee, specialites(nom))",
    )
    .eq("module_id", moduleId)
    .order("date", { ascending: true });

  if (groupeId) query = query.eq("groupe_id", groupeId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const seances = (data ?? []) as unknown as (Omit<
    SeanceAPreparer,
    "groupe_nom" | "groupe_annee" | "filiere" | "nb_versions"
  > & {
    groupes: {
      nom: string;
      annee: number | null;
      specialites: { nom: string } | null;
    } | null;
  })[];

  if (seances.length === 0) return [];

  // Un compte par séance en une seule requête : boucler ici ferait une requête
  // par ligne, ce que conventions.md L.53 interdit.
  const { data: fiches, error: errFiches } = await supabase
    .from("fiches_preparation")
    .select("seance_id")
    .in(
      "seance_id",
      seances.map((s) => s.id),
    );
  if (errFiches) throw new Error(errFiches.message);

  const comptes = new Map<string, number>();
  for (const f of fiches ?? []) {
    comptes.set(f.seance_id, (comptes.get(f.seance_id) ?? 0) + 1);
  }

  return seances.map((s) => ({
    id: s.id,
    date: s.date,
    heure_debut: s.heure_debut,
    heure_fin: s.heure_fin,
    statut: s.statut,
    objectif_operationnel: s.objectif_operationnel,
    contenu_prevu: s.contenu_prevu,
    contenu_realise: s.contenu_realise,
    groupe_id: s.groupe_id,
    groupe_nom: s.groupes?.nom ?? "—",
    groupe_annee: s.groupes?.annee ?? null,
    filiere: s.groupes?.specialites?.nom ?? "Digital Design",
    nb_versions: comptes.get(s.id) ?? 0,
  }));
}

export async function getFichesVersions(
  seanceId: string,
): Promise<FichePreparation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fiches_preparation")
    .select("id, seance_id, contenu, version, created_at")
    .eq("seance_id", seanceId)
    .order("version", { ascending: false });

  if (error) throw new Error(error.message);
  return data as FichePreparation[];
}

export async function saveFiche(seanceId: string, contenu: string) {
  const supabase = await createClient();

  const { data: derniere, error: errLecture } = await supabase
    .from("fiches_preparation")
    .select("version")
    .eq("seance_id", seanceId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (errLecture) throw new Error(errLecture.message);

  const next = (derniere?.version ?? 0) + 1;

  const { error } = await supabase
    .from("fiches_preparation")
    .insert({ seance_id: seanceId, contenu, version: next });
  if (error) throw new Error(error.message);

  revalidatePath("/modules");
  return next;
}
