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
