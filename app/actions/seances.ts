"use server";

import { createClient } from "@/lib/supabase/server";
import { libelleModule } from "@/lib/modules";
import { revalidatePath } from "next/cache";
import {
  creneauDe,
  dureeHeures,
  type BlocHoraire,
  type PartieBloc,
} from "@/lib/creneaux";
import {
  chargerQuestions,
  type QuestionSupport,
} from "@/app/actions/questions-support";
import type { Database, Json } from "@/lib/supabase/database.types";
import { sourceContenu } from "@/app/actions/partage";

/** Colonnes modifiables d'une séance, telles que la base les déclare. */
type MajTableSeance = Database["public"]["Tables"]["seances"]["Update"];

export type ModeSeance = "presentiel" | "distance";

export type Seance = {
  id: string;
  module_id: string;
  date: string | null;
  heure_debut: string | null;
  heure_fin: string | null;
  /** Séance à distance : la seule qui puisse réunir plusieurs groupes. */
  est_fad: boolean;
  lien_teams: string | null;
  objectif_operationnel: string | null;
  contenu_prevu: string | null;
  contenu_realise: string | null;
  duree_realisee: number | null;
  a_prevoir_prochaine_seance: string | null;
  statut: "a_faire" | "fait";
  duree_prevue: number | null;
  nature: "theorique" | "pratique" | null;
  suggestion_pedagogique_id: string | null;
  modules?: {
    nom: string;
    competences?: { code_operationnel: string | null } | null;
  } | null;
  /** Objectif d'apprentissage du référentiel, quand la séance vient du plan. */
  suggestions_pedagogiques?: { code: string | null; apprentissage_base: string } | null;
};

const COLONNES =
  "id, module_id, date, heure_debut, heure_fin, est_fad, lien_teams, " +
  "objectif_operationnel, contenu_prevu, contenu_realise, duree_realisee, " +
  "a_prevoir_prochaine_seance, statut, duree_prevue, nature, " +
  "suggestion_pedagogique_id, modules(nom, competences(code_operationnel)), " +
  "suggestions_pedagogiques(code, apprentissage_base)";

export async function getSeancesByGroupe(groupeId: string): Promise<Seance[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("seances")
    // `!inner` restreint aux séances liées à ce groupe : une séance FAD
    // partagée ressort donc pour chacun des groupes qu'elle réunit.
    .select(`${COLONNES}, seance_groupes!inner(groupe_id)`)
    .eq("seance_groupes.groupe_id", groupeId)
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
      module_id: input.moduleId,
      date: input.date,
      heure_debut: creneau.debut,
      heure_fin: creneau.fin,
      est_fad: input.mode === "distance",
      objectif_operationnel: input.objectifOperationnel?.trim() || null,
      contenu_prevu: input.contenuPrevu?.trim() || null,
      // Prérempli sur la durée du créneau ; ajustable une fois la séance faite.
      duree_realisee: duree,
      statut: "a_faire",
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  // La séance existe, son rattachement suit : une séance sans groupe n'est
  // lisible par personne, la politique d'écriture tolère cet instant.
  const { error: errLien } = await supabase
    .from("seance_groupes")
    .insert({ seance_id: data.id, groupe_id: input.groupeId });
  if (errLien) throw new Error(errLien.message);

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

  const update: MajTableSeance = { updated_at: new Date().toISOString() };
  if (input.contenu_realise !== undefined)
    update.contenu_realise = input.contenu_realise;
  if (input.objectif_operationnel !== undefined)
    update.objectif_operationnel = input.objectif_operationnel;
  if (input.a_prevoir_prochaine_seance !== undefined)
    update.a_prevoir_prochaine_seance = input.a_prevoir_prochaine_seance;
  if (input.duree_realisee !== undefined)
    update.duree_realisee = input.duree_realisee;
  if (input.statut) update.statut = input.statut;

  const { data, error } = await supabase
    .from("seances")
    .update(update)
    .eq("id", id)
    .select("id, seance_groupes(groupe_id)")
    .single();

  if (error) throw new Error(error.message);
  for (const lien of data.seance_groupes ?? []) {
    revalidatePath(`/groupes/${lien.groupe_id}/progression`);
  }
}

export async function deleteSeance(id: string, groupeId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("seances").delete().eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath(`/groupes/${groupeId}/progression`);
}

/* ---------------------------------------------------------------------------
   Une séance en particulier
   ---------------------------------------------------------------------------
   Ces fonctions vivaient dans `seance.ts`, à une lettre de ce fichier. Deux
   modules dont le nom ne diffère que par un « s » se confondent à l'import,
   et rien ne disait lequel portait quoi. Tout ce qui touche aux séances est
   ici : la liste d'un groupe au-dessus, une séance et son déroulement en bas.
--------------------------------------------------------------------------- */

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
  /** Séance à distance, et son lien de visioconférence. */
  est_fad: boolean;
  lien_teams: string | null;
  /** Les autres groupes réunis par cette séance, vide en présentiel. */
  groupesPartages: { id: string; nom: string }[];
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
  supportContenu: unknown | null;
  supportVersion: number | null;
  supportId: string | null;
  /** Questions posées par les stagiaires sur ce support. */
  questions: QuestionSupport[];
  /**
   * §4.3bis : séance qui porte réellement la fiche et le support affichés.
   * `null` quand cette séance les porte elle-même.
   */
  contenu_source_id: string | null;
  /** Groupes avec qui la fiche et le support sont partagés, et de quel côté. */
  partage: { role: "source" | "miroir"; groupes: string[] } | null;
};

/** Enregistre le support d'une séance en créant une nouvelle version. */
export async function saveSupport(
  seanceId: string,
  type: "theorique" | "pratique",
  contenu: Json,
) {
  const supabase = await createClient();
  // §4.3bis : le support suit la même règle que la fiche — il s'écrit sur la
  // séance qui porte le contenu, pour que les deux groupes le partagent.
  const source = await sourceContenu(seanceId);

  const { data: derniere, error: errLecture } = await supabase
    .from("supports_seance")
    .select("version")
    .eq("seance_id", source)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (errLecture) throw new Error(errLecture.message);

  const version = (derniere?.version ?? 0) + 1;
  const { error } = await supabase
    .from("supports_seance")
    .insert({ seance_id: source, type, contenu, version });
  if (error) throw new Error(error.message);

  revalidatePath("/groupes");
  return version;
}

/**
 * Détail d'une séance, lue depuis un groupe donné.
 *
 * Le groupe vient de l'appelant, pas de la séance : une séance FAD partagée
 * en réunit plusieurs, et c'est l'URL — `/groupes/[id]/seances/[seanceId]` —
 * qui dit lequel on regarde.
 */
export async function getSeanceDetail(
  seanceId: string,
  groupeId: string,
): Promise<SeanceDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("seances")
    .select(
      "id, module_id, contenu_source_id, date, heure_debut, heure_fin, duree_prevue, duree_realisee, statut, nature, est_fad, lien_teams, objectif_operationnel, contenu_prevu, contenu_realise, a_prevoir_prochaine_seance, modules(nom, competences(code_operationnel)), suggestions_pedagogiques(code, apprentissage_base, elements_contenu), seance_groupes!inner(groupe_id, groupes(nom, annee, specialites(nom))), tousGroupes:seance_groupes(groupe_id, groupes(nom))",
    )
    .eq("id", seanceId)
    .eq("seance_groupes.groupe_id", groupeId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const s = data as unknown as {
    id: string;
    module_id: string;
    contenu_source_id: string | null;
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
    est_fad: boolean;
    lien_teams: string | null;
    seance_groupes: {
      groupe_id: string;
      groupes: {
        nom: string;
        annee: number | null;
        specialites: { nom: string } | null;
      } | null;
    }[];
    tousGroupes: { groupe_id: string; groupes: { nom: string } | null }[];
    modules: {
      nom: string;
      competences: { code_operationnel: string | null } | null;
    } | null;
    suggestions_pedagogiques: {
      code: string | null;
      apprentissage_base: string;
      elements_contenu: string | null;
    } | null;
  };

  // §4.3bis : une séance miroir lit la fiche et le support de sa source.
  const sourceDuContenu = s.contenu_source_id ?? s.id;

  const [stagiairesRes, presencesRes, remarquesRes, ficheRes, supportRes] =
    await Promise.all([
    supabase
      .from("stagiaires")
      .select("id, nom, prenom")
      .eq("groupe_id", groupeId)
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
      .eq("seance_id", sourceDuContenu)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("supports_seance")
      .select("id, contenu, version")
      .eq("seance_id", sourceDuContenu)
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

  // `!inner` a déjà borné la lecture au groupe demandé : c'est le premier
  // lien, et les éventuels autres sont les groupes qui partagent la séance.
  const lienCourant =
    s.seance_groupes.find((l) => l.groupe_id === groupeId) ??
    s.seance_groupes[0];

  return {
    ...s,
    groupe_id: groupeId,
    groupeNom: lienCourant?.groupes?.nom ?? "—",
    filiere: lienCourant?.groupes?.specialites?.nom ?? "Digital Design",
    annee: lienCourant?.groupes?.annee ?? null,
    groupesPartages: (s.tousGroupes ?? [])
      .filter((l) => l.groupe_id !== groupeId)
      .map((l) => ({ id: l.groupe_id, nom: l.groupes?.nom ?? "Groupe" })),
    moduleNom: libelleModule(
      s.modules?.competences?.code_operationnel,
      s.modules?.nom,
    ),
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
    supportContenu: supportRes.data?.contenu ?? null,
    supportVersion: supportRes.data?.version ?? null,
    supportId: supportRes.data?.id ?? null,
    questions: supportRes.data?.id
      ? await chargerQuestions(supportRes.data.id, groupeId)
      : [],
    partage: await chargerPartage(s.id, s.contenu_source_id),
  };
}

/**
 * Décrit le partage de contenu d'une séance : soit elle porte la fiche et
 * d'autres la suivent (source), soit elle suit celle d'une autre (miroir).
 */
async function chargerPartage(
  seanceId: string,
  sourceId: string | null,
): Promise<{ role: "source" | "miroir"; groupes: string[] } | null> {
  const supabase = await createClient();
  const cible = sourceId ?? seanceId;

  // Côté miroir : le groupe de la source. Côté source : les groupes qui suivent.
  const { data } = await supabase
    .from("seances")
    .select("id, seance_groupes(groupes(nom))")
    .or(sourceId ? `id.eq.${sourceId}` : `contenu_source_id.eq.${seanceId}`);

  const liees = (data ?? []) as unknown as {
    id: string;
    seance_groupes: { groupes: { nom: string } | null }[];
  }[];
  const groupes = liees
    .filter((l) => l.id !== seanceId)
    .flatMap((l) => l.seance_groupes.map((g) => g.groupes?.nom ?? "Groupe"));
  if (groupes.length === 0) return null;

  return { role: cible === seanceId ? "source" : "miroir", groupes };
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
  statut?: "a_faire" | "fait";
  contenu_realise?: string | null;
  a_prevoir_prochaine_seance?: string | null;
  est_fad?: boolean;
  lien_teams?: string | null;
};

/**
 * Colonnes qu'un appel client a le droit de toucher.
 *
 * Le type ci-dessus décrit ce que l'interface envoie, pas ce qu'une requête
 * forgée peut envoyer : `...input` étalé dans l'update aurait écrit n'importe
 * quelle clé supplémentaire présente dans la charge utile. La RLS borne la
 * ligne atteignable, pas les colonnes écrites.
 */
const CHAMPS_MAJ_SEANCE = [
  "date",
  "heure_debut",
  "heure_fin",
  "statut",
  "contenu_realise",
  "a_prevoir_prochaine_seance",
] as const;

export async function majSeance(seanceId: string, input: MajSeance) {
  if (input.statut && input.statut !== "a_faire" && input.statut !== "fait") {
    throw new Error("Statut de séance inconnu.");
  }

  const supabase = await createClient();

  const update: MajTableSeance = { updated_at: new Date().toISOString() };
  if (input.date !== undefined) update.date = input.date;
  if (input.heure_debut !== undefined) update.heure_debut = input.heure_debut;
  if (input.heure_fin !== undefined) update.heure_fin = input.heure_fin;
  if (input.statut !== undefined) update.statut = input.statut;
  if (input.contenu_realise !== undefined)
    update.contenu_realise = input.contenu_realise;
  if (input.a_prevoir_prochaine_seance !== undefined)
    update.a_prevoir_prochaine_seance = input.a_prevoir_prochaine_seance;
  if (input.est_fad !== undefined) {
    update.est_fad = input.est_fad;
    // Repasser en présentiel efface le lien : il ne mène plus nulle part.
    if (!input.est_fad) update.lien_teams = null;
  }
  if (input.lien_teams !== undefined) update.lien_teams = input.lien_teams;

  // La durée réalisée se déduit du créneau : la ressaisir serait une occasion
  // de plus de se contredire.
  if (input.heure_debut && input.heure_fin) {
    update.duree_realisee = dureeHeures(input.heure_debut, input.heure_fin);
  }

  const { error } = await supabase
    .from("seances")
    .update(update)
    .eq("id", seanceId);

  if (error) throw new Error(error.message);
  revalidatePath(`/groupes`);
}
