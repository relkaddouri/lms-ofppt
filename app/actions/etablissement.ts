"use server";

import { createClient, getUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { LOGO_TAILLE_MAX } from "@/lib/etablissement";

/**
 * L'identité du centre de formation, imprimée en tête de tous les documents.
 *
 * Elle vaut pour un compte, pas pour un groupe ni pour un module : le
 * formateur exerce dans un établissement, et c'est le nom de cet établissement
 * que la Direction attend sur le tableau de service, le classeur pédagogique
 * et les contrôles.
 */
export type Etablissement = {
  nom: string | null;
  /** Logo en data URL, ou null tant qu'aucun n'a été déposé. */
  logo: string | null;
};

export async function getEtablissement(): Promise<Etablissement> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("parametres_formateur")
    .select("etablissement, logo_etablissement")
    .maybeSingle();

  if (error) throw new Error(error.message);

  return {
    nom: data?.etablissement?.trim() || null,
    logo: data?.logo_etablissement ?? null,
  };
}

export async function saveEtablissement(input: Etablissement): Promise<void> {
  const nom = input.nom?.trim() || null;
  if (nom && nom.length > 160) {
    throw new Error("Le nom de l'établissement ne peut pas dépasser 160 caractères.");
  }

  // Le contrôle du format est déjà posé en base ; le refaire ici évite un
  // aller-retour et rend le message lisible plutôt qu'un texte de contrainte.
  if (input.logo !== null) {
    if (!/^data:image\/(png|jpeg);base64,/.test(input.logo)) {
      throw new Error("Le logo doit être une image PNG ou JPEG.");
    }
    if (input.logo.length > LOGO_TAILLE_MAX * 1.4) {
      throw new Error("Le logo est trop lourd : 300 Ko au maximum.");
    }
  }

  const user = await getUser();
  if (!user) throw new Error("Authentification requise.");

  const supabase = await createClient();
  const { error } = await supabase.from("parametres_formateur").upsert(
    {
      formateur_id: user.id,
      etablissement: nom,
      logo_etablissement: input.logo,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "formateur_id" },
  );
  if (error) throw new Error(error.message);

  // Tous les écrans qui produisent un document portent désormais cette
  // identité : ils doivent la relire, pas servir la précédente.
  revalidatePath("/parametres");
  revalidatePath("/tableau-service");
  revalidatePath("/classeur");
}
