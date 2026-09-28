"use server";

import { cache } from "react";
import { revalidatePath } from "next/cache";
import { createClient, getUser } from "@/lib/supabase/server";
import { urlPhotoFormateur } from "@/lib/profil-formateur";

/**
 * Qui parle, dans le fil et sous un cours.
 *
 * Jusqu'ici : « Votre formateur ». La formule dit la fonction et rien de la
 * personne — dans un établissement où plusieurs formateurs interviennent sur
 * un même groupe, elle ne dit même plus lequel.
 *
 * L'identité est publique au sein de l'établissement (migration 106) : on la
 * lit avec les droits du lecteur, sans fonction privilégiée.
 */
export type IdentiteFormateur = {
  /** Nul tant que le formateur ne s'est pas nommé dans ses paramètres. */
  nom: string | null;
  /** Adresse publique de la photo, ou null. */
  photoUrl: string | null;
};

/** Ce que le formateur voit de lui-même dans ses réglages. */
export type MonProfil = {
  /** L'identifiant du compte : c'est le premier segment du chemin de photo. */
  id: string;
  nom: string | null;
  /** Chemin dans le bucket, tel qu'il est stocké — pas l'URL. */
  photo: string | null;
  photoUrl: string | null;
  /** L'adresse du compte, qui ne se change pas d'ici. */
  email: string | null;
};

/**
 * L'identité du formateur du groupe, pour un stagiaire.
 *
 * Deux colonnes, une ligne, et `cache()` par-dessus : le fil affiche la même
 * signature en tête de chaque annonce et sous chaque commentaire, ce qui
 * ferait autant de lectures par page sans cette mémoire de rendu.
 *
 * `limit(1)` : la table ne contient qu'un formateur aujourd'hui, mais rien ne
 * le garantit demain, et une requête sans borne est une requête qui grandit.
 */
const lireIdentiteFormateur = cache(
  async function lireIdentiteFormateur(): Promise<IdentiteFormateur> {
    const supabase = await createClient();
    // Même parti pris que `getMonProfil` : cette lecture décore un fil, elle
    // ne le conditionne pas. Une erreur laisse « Votre formateur ».
    const { data } = await supabase
      .from("profils")
      .select("nom_complet, photo")
      .eq("role", "formateur")
      .not("nom_complet", "is", null)
      .limit(1)
      .maybeSingle();

    return {
      nom: data?.nom_complet?.trim() || null,
      photoUrl: urlPhotoFormateur(data?.photo),
    };
  },
);

/**
 * La mémoire de rendu ne s'exporte pas telle quelle : un module « use server »
 * n'exporte que des fonctions `async`, et une constante y rend l'application
 * entière en erreur à l'exécution, avec un `tsc` vert.
 */
export async function getIdentiteFormateur(): Promise<IdentiteFormateur> {
  return lireIdentiteFormateur();
}

export async function getMonProfil(): Promise<MonProfil> {
  const user = await getUser();
  if (!user) throw new Error("Authentification requise.");

  const supabase = await createClient();
  const { data } = await supabase
    .from("profils")
    .select("nom_complet, photo")
    .eq("id", user.id)
    .maybeSingle();

  // L'échec ne se propage pas : le layout de tout l'espace formateur lit cette
  // ligne pour afficher un nom au pied du menu, et un `throw` y remplace
  // l'application entière par la page d'erreur de Next — c'est l'incident que
  // documente la migration 075. Un nom manquant vaut mieux qu'un écran rouge,
  // et l'écran des paramètres, lui, dira l'erreur au moment d'enregistrer.
  return {
    id: user.id,
    nom: data?.nom_complet?.trim() || null,
    photo: data?.photo ?? null,
    photoUrl: urlPhotoFormateur(data?.photo),
    email: user.email ?? null,
  };
}

/**
 * Enregistrer son nom, sa photo, ou les deux.
 *
 * Le fichier, lui, est déjà parti du navigateur vers le stockage : le faire
 * transiter par ici reviendrait à téléverser deux mégaoctets pour les
 * réémettre aussitôt, sans rien vérifier de plus (c'est déjà le parti pris
 * de la photo de stagiaire).
 */
export async function saveMonProfil(input: {
  nom: string | null;
  photo: string | null;
}): Promise<void> {
  const nom = input.nom?.trim() || null;
  if (nom && nom.length > 120) {
    throw new Error("Le nom ne peut pas dépasser 120 caractères.");
  }

  const user = await getUser();
  if (!user) throw new Error("Authentification requise.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("profils")
    .update({
      nom_complet: nom,
      photo: input.photo,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) throw new Error(error.message);

  // La signature s'affiche des deux côtés : les réglages et la barre latérale
  // du formateur, le fil et les cours du stagiaire.
  revalidatePath("/parametres");
  revalidatePath("/", "layout");
  revalidatePath("/espace-stagiaire", "layout");
}
