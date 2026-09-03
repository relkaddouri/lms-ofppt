"use server";

import { createClient, getUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { LOGO_TAILLE_MAX } from "@/lib/etablissement";

/**
 * Ce qui identifie le formateur et son centre en tête des documents.
 *
 * Cela vaut pour un compte, pas pour un groupe ni pour un module : le
 * formateur exerce dans un établissement, et c'est ce bloc que la Direction
 * attend sur le tableau de service, le classeur pédagogique et les contrôles.
 *
 * `nom` et `logo` sont ce que porte l'en-tête de tous les documents ; les cinq
 * autres champs ne servent aujourd'hui qu'au tableau de service, dont le
 * format officiel les impose (PRD §4.13bis).
 */
export type Etablissement = {
  nom: string | null;
  /** Logo en data URL, ou null tant qu'aucun n'a été déposé. */
  logo: string | null;
  /** Nom sous lequel le formateur signe. À défaut, l'adresse du compte. */
  nomFormateur: string | null;
  matricule: string | null;
  /** Par exemple « Pôle DIA ». */
  codeSecteur: string | null;
  /** Par exemple « TS » pour technicien spécialisé. */
  niveauFormation: string | null;
  /** Format AAAA/AAAA. */
  anneeScolaire: string | null;
};

export async function getEtablissement(): Promise<Etablissement> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("parametres_formateur")
    .select(
      "etablissement, logo_etablissement, nom_formateur, matricule, code_secteur, niveau_formation, annee_scolaire",
    )
    .maybeSingle();

  if (error) throw new Error(error.message);

  return {
    nom: data?.etablissement?.trim() || null,
    logo: data?.logo_etablissement ?? null,
    nomFormateur: data?.nom_formateur?.trim() || null,
    matricule: data?.matricule?.trim() || null,
    codeSecteur: data?.code_secteur?.trim() || null,
    niveauFormation: data?.niveau_formation?.trim() || null,
    anneeScolaire: data?.annee_scolaire?.trim() || null,
  };
}

export async function saveEtablissement(input: Etablissement): Promise<void> {
  const texte = (v: string | null) => v?.trim() || null;

  const nom = texte(input.nom);
  if (nom && nom.length > 160) {
    throw new Error("Le nom de l'établissement ne peut pas dépasser 160 caractères.");
  }

  const courts: [string | null, string][] = [
    [texte(input.nomFormateur), "Le nom du formateur"],
    [texte(input.matricule), "Le matricule"],
    [texte(input.codeSecteur), "Le code secteur"],
    [texte(input.niveauFormation), "Le niveau de formation"],
  ];
  for (const [valeur, libelle] of courts) {
    if (valeur && valeur.length > 80) {
      throw new Error(`${libelle} ne peut pas dépasser 80 caractères.`);
    }
  }

  // La base pose la même contrainte ; la reprendre ici donne un message qui
  // dit quoi corriger, au lieu du texte d'une contrainte Postgres.
  const anneeScolaire = texte(input.anneeScolaire);
  if (anneeScolaire && !/^[0-9]{4}\/[0-9]{4}$/.test(anneeScolaire)) {
    throw new Error("L'année scolaire s'écrit au format 2025/2026.");
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
      nom_formateur: texte(input.nomFormateur),
      matricule: texte(input.matricule),
      code_secteur: texte(input.codeSecteur),
      niveau_formation: texte(input.niveauFormation),
      annee_scolaire: anneeScolaire,
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
