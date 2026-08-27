"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { dureeHeures } from "@/lib/creneaux";

export type PresenceStagiaire = {
  stagiaire_id: string;
  nom: string;
  prenom: string;
  present: boolean | null;
  motif: string | null;
};

export type RemarqueSeance = {
  id: string;
  texte: string;
  created_at: string;
};

export type SeanceDetail = {
  id: string;
  groupe_id: string;
  module_id: string;
  groupeNom: string;
  /** Pour l'en-tête du formulaire officiel de fiche. */
  filiere: string;
  annee: number | null;
  moduleNom: string;
  date: string | null;
  heure_debut: string | null;
  heure_fin: string | null;
  duree_prevue: number | null;
  duree_realisee: number | null;
  statut: string;
  nature: "theorique" | "pratique" | null;
  objectif_operationnel: string | null;
  contenu_prevu: string | null;
  contenu_realise: string | null;
  a_prevoir_prochaine_seance: string | null;
  /** Objectif d'apprentissage du référentiel, s'il est rattaché. */
  objectifCode: string | null;
  objectifIntitule: string | null;
  objectifContenu: string | null;
  presences: PresenceStagiaire[];
  remarques: RemarqueSeance[];
  ficheContenu: string | null;
  ficheVersion: number | null;
};

export async function getSeanceDetail(
  seanceId: string,
): Promise<SeanceDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("seances")
    .select(
      "id, groupe_id, module_id, date, heure_debut, heure_fin, duree_prevue, duree_realisee, statut, nature, objectif_operationnel, contenu_prevu, contenu_realise, a_prevoir_prochaine_seance, groupes(nom, annee, specialites(nom)), modules(nom), suggestions_pedagogiques(code, apprentissage_base, elements_contenu)",
    )
    .eq("id", seanceId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const s = data as unknown as {
    id: string;
    groupe_id: string;
    module_id: string;
    date: string | null;
    heure_debut: string | null;
    heure_fin: string | null;
    duree_prevue: number | null;
    duree_realisee: number | null;
    statut: string;
    nature: "theorique" | "pratique" | null;
    objectif_operationnel: string | null;
    contenu_prevu: string | null;
    contenu_realise: string | null;
    a_prevoir_prochaine_seance: string | null;
    groupes: {
      nom: string;
      annee: number | null;
      specialites: { nom: string } | null;
    } | null;
    modules: { nom: string } | null;
    suggestions_pedagogiques: {
      code: string | null;
      apprentissage_base: string;
      elements_contenu: string | null;
    } | null;
  };

  const [stagiairesRes, presencesRes, remarquesRes, ficheRes] = await Promise.all([
    supabase
      .from("stagiaires")
      .select("id, nom, prenom")
      .eq("groupe_id", s.groupe_id)
      .order("nom"),
    supabase
      .from("presences")
      .select("stagiaire_id, present, motif")
      .eq("seance_id", seanceId),
    supabase
      .from("remarques_seance")
      .select("id, texte, created_at")
      .eq("seance_id", seanceId)
      .order("created_at", { ascending: false }),
    supabase
      .from("fiches_preparation")
      .select("contenu, version")
      .eq("seance_id", seanceId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (stagiairesRes.error) throw new Error(stagiairesRes.error.message);
  if (presencesRes.error) throw new Error(presencesRes.error.message);
  if (remarquesRes.error) throw new Error(remarquesRes.error.message);

  const parStagiaire = new Map(
    (presencesRes.data ?? []).map((p) => [p.stagiaire_id, p]),
  );

  return {
    ...s,
    groupeNom: s.groupes?.nom ?? "—",
    filiere: s.groupes?.specialites?.nom ?? "Digital Design",
    annee: s.groupes?.annee ?? null,
    moduleNom: s.modules?.nom ?? "—",
    objectifCode: s.suggestions_pedagogiques?.code ?? null,
    objectifIntitule: s.suggestions_pedagogiques?.apprentissage_base ?? null,
    objectifContenu: s.suggestions_pedagogiques?.elements_contenu ?? null,
    presences: (stagiairesRes.data ?? []).map((st) => {
      const p = parStagiaire.get(st.id);
      return {
        stagiaire_id: st.id,
        nom: st.nom,
        prenom: st.prenom,
        present: p ? p.present : null,
        motif: p?.motif ?? null,
      };
    }),
    remarques: (remarquesRes.data ?? []) as RemarqueSeance[],
    ficheContenu: ficheRes.data?.contenu ?? null,
    ficheVersion: ficheRes.data?.version ?? null,
  };
}

export async function setPresence(
  seanceId: string,
  stagiaireId: string,
  present: boolean,
  motif: string | null,
) {
  const supabase = await createClient();
  const { error } = await supabase.from("presences").upsert(
    {
      seance_id: seanceId,
      stagiaire_id: stagiaireId,
      present,
      // Un motif n'a de sens que pour une absence.
      motif: present ? null : (motif?.trim() || null),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "seance_id,stagiaire_id" },
  );
  if (error) throw new Error(error.message);
  revalidatePath(`/groupes`);
}

/** Appel complet en une fois : tout le monde présent, puis on décoche. */
export async function marquerToutPresent(seanceId: string, stagiaireIds: string[]) {
  if (stagiaireIds.length === 0) return;
  const supabase = await createClient();
  const { error } = await supabase.from("presences").upsert(
    stagiaireIds.map((id) => ({
      seance_id: seanceId,
      stagiaire_id: id,
      present: true,
      motif: null,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "seance_id,stagiaire_id" },
  );
  if (error) throw new Error(error.message);
  revalidatePath(`/groupes`);
}

export async function ajouterRemarque(seanceId: string, texte: string) {
  const propre = texte.trim();
  if (!propre) throw new Error("La remarque est vide.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("remarques_seance")
    .insert({ seance_id: seanceId, texte: propre });
  if (error) throw new Error(error.message);
  revalidatePath(`/groupes`);
}

export async function supprimerRemarque(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("remarques_seance").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/groupes`);
}

export type MajSeance = {
  date?: string | null;
  heure_debut?: string | null;
  heure_fin?: string | null;
  statut?: string;
  contenu_realise?: string | null;
  a_prevoir_prochaine_seance?: string | null;
};

export async function majSeance(seanceId: string, input: MajSeance) {
  const supabase = await createClient();

  // La durée réalisée se déduit du créneau : la ressaisir serait une occasion
  // de plus de se contredire.
  const duree =
    input.heure_debut && input.heure_fin
      ? dureeHeures(input.heure_debut, input.heure_fin)
      : undefined;

  const { error } = await supabase
    .from("seances")
    .update({
      ...input,
      ...(duree !== undefined ? { duree_realisee: duree } : {}),
    })
    .eq("id", seanceId);

  if (error) throw new Error(error.message);
  revalidatePath(`/groupes`);
}
