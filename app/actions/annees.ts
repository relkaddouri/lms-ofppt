"use server";

import { createClient, getUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { AnneeScolaire } from "@/lib/annees";

/**
 * Les années scolaires du formateur, la plus récente en tête.
 *
 * Les données d'une année passée ne sont jamais supprimées en changeant de
 * sélection (PRD §4.15) : la liste sert à y revenir en lecture autant qu'à
 * travailler sur l'année en cours.
 */
export async function getAnneesScolaires(): Promise<AnneeScolaire[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("annees_scolaires")
    .select("id, libelle, date_debut, date_fin")
    .order("date_debut", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((a) => ({
    id: a.id,
    libelle: a.libelle,
    dateDebut: a.date_debut,
    dateFin: a.date_fin,
  }));
}

/**
 * L'année sur laquelle porte tout ce qui est affiché.
 *
 * `null` seulement quand le formateur n'a aucune année — un compte neuf avant
 * sa première rentrée. Sinon, faute de choix explicite, c'est la plus récente
 * qui s'applique, exactement comme la valeur par défaut des écritures.
 */
export async function getAnneeCourante(): Promise<AnneeScolaire | null> {
  const supabase = await createClient();

  const [{ data: parametres }, annees] = await Promise.all([
    supabase
      .from("parametres_formateur")
      .select("annee_scolaire_courante")
      .maybeSingle(),
    getAnneesScolaires(),
  ]);

  const choisie = parametres?.annee_scolaire_courante;
  return (
    annees.find((a) => a.id === choisie) ?? annees[0] ?? null
  );
}

export async function choisirAnneeScolaire(anneeId: string): Promise<void> {
  const user = await getUser();
  if (!user) throw new Error("Authentification requise.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("choisir_annee_scolaire", {
    p_annee_id: anneeId,
  });
  if (error) throw new Error(error.message);

  // Changer d'année change la portée de tout : rien de ce qui est en cache ne
  // reste valable.
  revalidatePath("/", "layout");
}

/**
 * La portée de l'année sélectionnée : son identifiant et ses groupes.
 *
 * Presque tout ce qui s'affiche pend d'un groupe, directement ou par
 * `seance_groupes` : la liste des groupes de l'année suffit donc à borner un
 * agrégat, sans que chaque table porte le champ. Les trois tables datées du
 * formateur — indisponibilités, rythmes, motifs — se bornent, elles, par
 * l'identifiant de l'année, qu'elles portent.
 *
 * Une liste vide n'est pas une absence de portée : elle veut dire « aucun
 * groupe cette année », et un agrégat doit alors être vide, pas complet. Les
 * appelants doivent donc filtrer sur `groupeIds` même quand il est vide.
 */
export type Portee = {
  anneeId: string | null;
  groupeIds: string[];
};

export async function getPortee(): Promise<Portee> {
  const supabase = await createClient();
  const annee = await getAnneeCourante();

  if (!annee) return { anneeId: null, groupeIds: [] };

  const { data, error } = await supabase
    .from("groupes")
    .select("id")
    .eq("annee_scolaire_id", annee.id);

  if (error) throw new Error(error.message);

  return { anneeId: annee.id, groupeIds: (data ?? []).map((g) => g.id) };
}

export type GroupeADupliquer = {
  id: string;
  nom: string;
  annee: number | null;
  nbModules: number;
  nbSeances: number;
  nbControles: number;
};

/**
 * Les groupes d'une année, avec de quoi décider lesquels reconduire.
 *
 * Le formateur ne reconduit pas forcément tout : un groupe qui n'existera plus
 * se décoche (PRD §4.15). Les compteurs disent ce que la duplication emporte
 * avec chaque groupe.
 */
export async function getGroupesADupliquer(
  anneeId: string,
): Promise<GroupeADupliquer[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("groupes")
    .select(
      "id, nom, annee, groupe_modules(count), seance_groupes(count), controles(count)",
    )
    .eq("annee_scolaire_id", anneeId)
    .order("nom");

  if (error) throw new Error(error.message);

  const compte = (v: unknown) =>
    Array.isArray(v) && v.length > 0
      ? Number((v[0] as { count?: number }).count ?? 0)
      : 0;

  return (data ?? []).map((g) => {
    const r = g as unknown as {
      id: string;
      nom: string;
      annee: number | null;
      groupe_modules: unknown;
      seance_groupes: unknown;
      controles: unknown;
    };
    return {
      id: r.id,
      nom: r.nom,
      annee: r.annee,
      nbModules: compte(r.groupe_modules),
      nbSeances: compte(r.seance_groupes),
      nbControles: compte(r.controles),
    };
  });
}

/**
 * Crée une nouvelle année à partir d'une précédente et la sélectionne.
 *
 * La copie elle-même se fait en base, en une transaction : une duplication
 * interrompue à mi-chemin laisserait une année à moitié peuplée. Ce qui repart
 * de zéro — stagiaires, copies, présences — n'est pas copié ; le motif
 * hebdomadaire non plus, il se redéclare et datera ensuite les séances
 * reconduites, qui arrivent sans date.
 */
export async function dupliquerAnnee(
  anneeSourceId: string,
  libelle: string,
  groupeIds: string[],
): Promise<string> {
  const user = await getUser();
  if (!user) throw new Error("Authentification requise.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dupliquer_annee", {
    p_annee_source: anneeSourceId,
    p_libelle: libelle.trim(),
    p_groupe_ids: groupeIds,
  });
  if (error) throw new Error(error.message);

  const nouvelle = data as unknown as string;

  // On bascule sur l'année créée : c'est celle sur laquelle on va travailler,
  // et la laisser en arrière-plan obligerait à la chercher.
  const { error: errChoix } = await supabase.rpc("choisir_annee_scolaire", {
    p_annee_id: nouvelle,
  });
  if (errChoix) throw new Error(errChoix.message);

  revalidatePath("/", "layout");
  return nouvelle;
}
