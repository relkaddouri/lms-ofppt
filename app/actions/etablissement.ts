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

  /*
    Les huit lignes que le cahier du formateur demande en plus (migration 113).
    Elles se recopiaient à la main dans Word à chaque édition du classeur.
    Toutes facultatives : le cahier sort avec des cases vides plutôt que de
    refuser de s'éditer.
  */
  /** Format AAAA-MM-JJ, comme le rend la base. */
  dateRecrutement: string | null;
  /** « Cadre », « Technicien spécialisé »… La nomenclature change, d'où le texte libre. */
  grade: string | null;
  /** Texte et non nombre : certains échelons s'écrivent « 01 », avec leur zéro. */
  echelon: string | null;
  diplome: string | null;
  /** Celle du formateur, qui n'est pas toujours celle où il enseigne. */
  specialiteOrigine: string | null;
  /** Celle de la filière prise en charge. */
  specialiteAffectation: string | null;
  dateAffectation: string | null;
  /** Souvent vide : le cahier porte alors un tiret. */
  dateDernierBilan: string | null;
};

export async function getEtablissement(): Promise<Etablissement> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("parametres_formateur")
    .select(
      "etablissement, logo_etablissement, nom_formateur, matricule, code_secteur, niveau_formation, annee_scolaire, date_recrutement, grade, echelon, diplome, specialite_origine, specialite_affectation, date_affectation, date_dernier_bilan",
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
    dateRecrutement: data?.date_recrutement ?? null,
    grade: data?.grade?.trim() || null,
    echelon: data?.echelon?.trim() || null,
    diplome: data?.diplome?.trim() || null,
    specialiteOrigine: data?.specialite_origine?.trim() || null,
    specialiteAffectation: data?.specialite_affectation?.trim() || null,
    dateAffectation: data?.date_affectation ?? null,
    dateDernierBilan: data?.date_dernier_bilan ?? null,
  };
}

export async function saveEtablissement(input: Etablissement): Promise<void> {
  const texte = (v: string | null) => v?.trim() || null;
  /** Une date non saisie part nulle : la colonne est de type date. */
  const date = (v: string | null) => {
    const t = v?.trim();
    if (!t) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) {
      throw new Error("Une date s'écrit au format AAAA-MM-JJ.");
    }
    return t;
  };

  const nom = texte(input.nom);
  if (nom && nom.length > 160) {
    throw new Error("Le nom de l'établissement ne peut pas dépasser 160 caractères.");
  }

  // Plus long que les champs courts : un intitulé de diplôme tient rarement en
  // quatre-vingts caractères.
  const diplome = texte(input.diplome);
  if (diplome && diplome.length > 160) {
    throw new Error("Le diplôme ne peut pas dépasser 160 caractères.");
  }

  const courts: [string | null, string][] = [
    [texte(input.nomFormateur), "Le nom du formateur"],
    [texte(input.matricule), "Le matricule"],
    [texte(input.codeSecteur), "Le code secteur"],
    [texte(input.niveauFormation), "Le niveau de formation"],
    [texte(input.grade), "Le grade"],
    [texte(input.echelon), "L'échelon"],
    [texte(input.specialiteOrigine), "La spécialité d'origine"],
    [texte(input.specialiteAffectation), "La spécialité d'affectation"],
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
      // Une date vide s'enregistre nulle et non chaîne vide : la colonne est
      // de type date, et Postgres refuse « » — c'est l'erreur qui a fait
      // tomber des écrans en production sur les identifiants.
      date_recrutement: date(input.dateRecrutement),
      grade: texte(input.grade),
      echelon: texte(input.echelon),
      diplome,
      specialite_origine: texte(input.specialiteOrigine),
      specialite_affectation: texte(input.specialiteAffectation),
      date_affectation: date(input.dateAffectation),
      date_dernier_bilan: date(input.dateDernierBilan),
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
