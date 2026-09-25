"use server";

import { createClient, getUser } from "@/lib/supabase/server";
import { baremeAttendu, type TypeControleBareme } from "@/lib/controles";
import { maintenant } from "@/lib/format";
import { revalidatePath } from "next/cache";

/**
 * Le classement d'une épreuve, annoncé au groupe (demande du 25/09/2026).
 *
 * Quand le formateur a fini de publier les copies, il annonce le classement :
 * les trois premiers sur un podium, puis la classe rang par rang. Le but est
 * d'entretenir l'émulation, pas de désigner des derniers — c'est pourquoi
 * l'annonce s'ouvre sur ceux qui ont réussi, et que chacun retrouve sa propre
 * ligne mise en avant dans la suite.
 *
 * Ne sont classées que les copies **publiées** : une note que son stagiaire
 * n'a pas encore vue ne peut pas s'afficher devant le groupe. Le compte de
 * test du formateur n'y entre jamais (migration 093).
 */

export type LigneClassement = {
  rang: number;
  stagiaireId: string;
  nom: string;
  prenom: string;
  photo: string | null;
  note: number;
};

export type Classement = {
  controleId: string;
  groupeId: string;
  titre: string;
  moduleNom: string | null;
  /** 20 pour un contrôle continu, 40 pour une épreuve de fin de module. */
  total: number;
  moyenne: number | null;
  lignes: LigneClassement[];
  /** Copies publiées sur le nombre de stagiaires du groupe. */
  publiees: number;
  effectif: number;
  /** L'annonce déjà publiée pour ce contrôle, s'il y en a une. */
  annonceId: string | null;
  annonceLe: string | null;
};

type CopieLue = {
  note: number | string | null;
  publie_le: string | null;
  stagiaires: {
    id: string;
    nom: string;
    prenom: string;
    photo: string | null;
    est_test: boolean;
  } | null;
};

/**
 * Les rangs, ex æquo compris.
 *
 * Deux 15/20 partagent la deuxième place, et la suivante est la quatrième :
 * c'est la règle d'un classement sportif, celle que tout le monde lit sans
 * explication.
 */
function classer(copies: CopieLue[]): LigneClassement[] {
  const retenues = copies
    .filter((c) => c.publie_le && c.stagiaires && !c.stagiaires.est_test)
    .map((c) => ({ note: Number(c.note) || 0, s: c.stagiaires! }))
    .sort((a, b) => b.note - a.note || a.s.nom.localeCompare(b.s.nom, "fr"));

  let rang = 0;
  let precedente: number | null = null;
  return retenues.map((r, i) => {
    if (precedente === null || r.note !== precedente) rang = i + 1;
    precedente = r.note;
    return {
      rang,
      stagiaireId: r.s.id,
      nom: r.s.nom,
      prenom: r.s.prenom,
      photo: r.s.photo,
      note: r.note,
    };
  });
}

export async function getClassement(
  controleId: string,
): Promise<Classement | null> {
  const supabase = await createClient();

  const { data: controle, error } = await supabase
    .from("controles")
    .select("id, groupe_id, titre, type, bareme_total, modules(nom)")
    .eq("id", controleId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!controle?.groupe_id) return null;

  const [copiesRes, effectifRes, annonceRes] = await Promise.all([
    supabase
      .from("passations_controle")
      .select("note, publie_le, stagiaires(id, nom, prenom, photo, est_test)")
      .eq("controle_id", controleId),
    supabase
      .from("stagiaires")
      .select("id", { count: "exact", head: true })
      .eq("groupe_id", controle.groupe_id)
      .eq("est_test", false),
    supabase
      .from("classements_controle")
      .select("annonce_id, created_at")
      .eq("controle_id", controleId)
      .maybeSingle(),
  ]);
  if (copiesRes.error) throw new Error(copiesRes.error.message);

  const lignes = classer((copiesRes.data ?? []) as unknown as CopieLue[]);
  const moyenne =
    lignes.length > 0
      ? Math.round(
          (lignes.reduce((s, l) => s + l.note, 0) / lignes.length) * 10,
        ) / 10
      : null;

  return {
    controleId,
    groupeId: controle.groupe_id,
    titre: controle.titre ?? "Contrôle",
    moduleNom: (controle.modules as { nom: string } | null)?.nom ?? null,
    total: baremeAttendu(
      controle.type as TypeControleBareme,
      controle.bareme_total,
    ),
    moyenne,
    lignes,
    publiees: lignes.length,
    effectif: effectifRes.count ?? 0,
    annonceId: annonceRes.data?.annonce_id ?? null,
    annonceLe: annonceRes.data?.created_at ?? null,
  };
}

/**
 * Publie — ou met à jour — l'annonce du classement.
 *
 * Réannoncer ne crée pas une seconde annonce : elle est réécrite sur place,
 * avec ses j'aime et ses commentaires. Le groupe a déjà lu la première ; en
 * empiler une deuxième donnerait deux podiums contradictoires dans le fil.
 */
export async function annoncerClassement(controleId: string): Promise<void> {
  const user = await getUser();
  if (!user) throw new Error("Authentification requise.");

  const classement = await getClassement(controleId);
  if (!classement) throw new Error("Contrôle introuvable.");
  if (classement.lignes.length === 0) {
    throw new Error(
      "Aucune copie publiée : publiez d'abord les résultats, depuis Copies.",
    );
  }

  const supabase = await createClient();
  const premier = classement.lignes[0]!;
  const nombre = classement.lignes.length;
  const contenu = [
    `${premier.prenom} ${premier.nom} prend la première place avec ${premier.note
      .toLocaleString("fr-FR")}/${classement.total}.`,
    `${nombre} copie${nombre > 1 ? "s" : ""} corrigée${nombre > 1 ? "s" : ""}${
      classement.moyenne !== null
        ? `, moyenne de la classe ${classement.moyenne.toLocaleString("fr-FR")}/${classement.total}`
        : ""
    }. Chacun retrouve son rang et sa note ci-dessous.`,
  ].join(" ");
  const titre = `Résultats — ${classement.titre}`;

  const lignes = classement.lignes as unknown as never;

  if (classement.annonceId) {
    const { error } = await supabase
      .from("annonces")
      .update({ titre, contenu, date: maintenant() })
      .eq("id", classement.annonceId);
    if (error) throw new Error(error.message);

    const { error: errLignes } = await supabase
      .from("classements_controle")
      .update({
        lignes,
        moyenne: classement.moyenne,
        total: classement.total,
      })
      .eq("annonce_id", classement.annonceId);
    if (errLignes) throw new Error(errLignes.message);
  } else {
    const { data: annonce, error } = await supabase
      .from("annonces")
      .insert({
        groupe_id: classement.groupeId,
        titre,
        contenu,
        date: maintenant(),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { error: errLignes } = await supabase
      .from("classements_controle")
      .insert({
        annonce_id: annonce.id,
        controle_id: controleId,
        groupe_id: classement.groupeId,
        lignes,
        moyenne: classement.moyenne,
        total: classement.total,
      });
    if (errLignes) throw new Error(errLignes.message);
  }

  revalidatePath("/espace-stagiaire/fil");
}
