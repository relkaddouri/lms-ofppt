"use server";

import { createClient, getUser } from "@/lib/supabase/server";
import { libelleModule } from "@/lib/modules";
import { BUCKET_RENDUS } from "@/lib/devoirs";
import { revalidatePath } from "next/cache";

export type TypeRendu = "texte" | "lien" | "fichier";

export type Devoir = {
  id: string;
  groupe_id: string;
  seance_id: string | null;
  module_id: string | null;
  titre: string;
  description: string | null;
  date_echeance: string | null;
  type_rendu: TypeRendu;
  moduleNom: string | null;
  /** Rendus enregistrés, du point de vue du formateur. */
  nbRendus: number;
  nbStagiaires: number;
};

export type FichierRendu = {
  chemin: string;
  nom: string;
  taille: number | null;
};

export type MonRendu = {
  id: string;
  contenu: string | null;
  statut: "brouillon" | "rendu";
  date_rendu: string | null;
  fichier: FichierRendu | null;
};

export type DevoirStagiaire = Omit<Devoir, "nbRendus" | "nbStagiaires"> & {
  monRendu: MonRendu | null;
  /**
   * Le dépôt se fait depuis le navigateur, sous la session du stagiaire : le
   * chemin dépend de son identifiant, que le client ne doit pas deviner.
   */
  stagiaireId: string;
};

/** Devoirs d'un groupe, vus par le formateur. */
export async function getDevoirsGroupe(groupeId: string): Promise<Devoir[]> {
  const supabase = await createClient();

  const [devoirsRes, stagiairesRes] = await Promise.all([
    supabase
      .from("devoirs")
      .select(
        "id, groupe_id, seance_id, module_id, titre, description, date_echeance, type_rendu, modules(nom, competences(code_operationnel)), devoirs_rendus(id, statut)",
      )
      .eq("groupe_id", groupeId)
      .order("date_echeance", { nullsFirst: false }),
    supabase
      .from("stagiaires")
      .select("id", { count: "exact", head: true })
      .eq("groupe_id", groupeId),
  ]);

  if (devoirsRes.error) throw new Error(devoirsRes.error.message);

  const nbStagiaires = stagiairesRes.count ?? 0;

  return (
    devoirsRes.data as unknown as (Omit<
      Devoir,
      "moduleNom" | "nbRendus" | "nbStagiaires"
    > & {
      modules: {
        nom: string;
        competences: { code_operationnel: string | null } | null;
      } | null;
      devoirs_rendus: { id: string; statut: string }[] | null;
    })[]
  ).map((d) => ({
    id: d.id,
    groupe_id: d.groupe_id,
    seance_id: d.seance_id,
    module_id: d.module_id,
    titre: d.titre,
    description: d.description,
    date_echeance: d.date_echeance,
    type_rendu: d.type_rendu,
    moduleNom: d.modules
      ? libelleModule(d.modules.competences?.code_operationnel, d.modules.nom)
      : null,
    // Un brouillon n'est pas un rendu : le stagiaire ne l'a pas remis.
    nbRendus: (d.devoirs_rendus ?? []).filter((r) => r.statut === "rendu").length,
    nbStagiaires,
  }));
}

/** Devoirs du stagiaire connecté, avec son propre rendu. */
export async function getMesDevoirs(): Promise<DevoirStagiaire[]> {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return [];

  const { data: moi } = await supabase
    .from("stagiaires")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!moi) return [];

  const { data, error } = await supabase
    .from("devoirs")
    .select(
      "id, groupe_id, seance_id, module_id, titre, description, date_echeance, type_rendu, modules(nom, competences(code_operationnel)), devoirs_rendus(id, contenu, statut, date_rendu, stagiaire_id, fichier_chemin, fichier_nom, fichier_taille)",
    )
    .order("date_echeance", { nullsFirst: false });

  if (error) throw new Error(error.message);

  return (
    data as unknown as (Omit<DevoirStagiaire, "moduleNom" | "monRendu"> & {
      modules: {
        nom: string;
        competences: { code_operationnel: string | null } | null;
      } | null;
      devoirs_rendus:
        | {
            id: string;
            contenu: string | null;
            fichier_chemin: string | null;
            fichier_nom: string | null;
            fichier_taille: number | null;
            statut: "brouillon" | "rendu";
            date_rendu: string | null;
            stagiaire_id: string;
          }[]
        | null;
    })[]
  ).map((d) => {
    // Les policies ne renvoient déjà que son propre rendu ; on filtre par
    // sécurité plutôt que de s'en remettre à l'ordre des lignes.
    const mien = (d.devoirs_rendus ?? []).find((r) => r.stagiaire_id === moi.id);
    return {
      id: d.id,
      groupe_id: d.groupe_id,
      seance_id: d.seance_id,
      module_id: d.module_id,
      titre: d.titre,
      description: d.description,
      date_echeance: d.date_echeance,
      type_rendu: d.type_rendu,
      moduleNom: d.modules
      ? libelleModule(d.modules.competences?.code_operationnel, d.modules.nom)
      : null,
      stagiaireId: moi.id,
      monRendu: mien
        ? {
            id: mien.id,
            contenu: mien.contenu,
            statut: mien.statut,
            date_rendu: mien.date_rendu,
            fichier: mien.fichier_chemin
              ? {
                  chemin: mien.fichier_chemin,
                  nom: mien.fichier_nom ?? "rendu",
                  taille: mien.fichier_taille,
                }
              : null,
          }
        : null,
    };
  });
}

export type SaisieDevoir = {
  groupeId: string;
  titre: string;
  description: string | null;
  dateEcheance: string | null;
  typeRendu: TypeRendu;
  moduleId: string | null;
  seanceId: string | null;
};

export async function creerDevoir(input: SaisieDevoir) {
  if (!input.titre.trim()) throw new Error("Le devoir a besoin d'un titre.");

  const supabase = await createClient();
  const { error } = await supabase.from("devoirs").insert({
    groupe_id: input.groupeId,
    titre: input.titre.trim(),
    description: input.description?.trim() || null,
    date_echeance: input.dateEcheance || null,
    type_rendu: input.typeRendu,
    module_id: input.moduleId,
    seance_id: input.seanceId,
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/groupes/${input.groupeId}/devoirs`);
}

export async function supprimerDevoir(id: string, groupeId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("devoirs").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/groupes/${groupeId}/devoirs`);
}

/**
 * Enregistre ou remet un rendu.
 *
 * Un brouillon reste modifiable ; une remise est datée et ne se reprend pas
 * depuis l'espace stagiaire — c'est ce qui distingue « j'y travaille » de
 * « je rends ».
 */
export async function enregistrerRendu(
  devoirId: string,
  contenu: string,
  remettre: boolean,
  fichier: FichierRendu | null = null,
) {
  const user = await getUser();
  if (!user) throw new Error("Authentification requise.");

  const supabase = await createClient();
  const { data: moi } = await supabase
    .from("stagiaires")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!moi) throw new Error("Aucune fiche stagiaire pour ce compte.");

  // Un fichier déposé vaut rendu : exiger en plus du texte reviendrait à
  // refuser une remise complète.
  if (remettre && !contenu.trim() && !fichier) {
    throw new Error("Un devoir vide ne peut pas être remis.");
  }

  // Le chemin porte la règle des policies : il doit désigner ce devoir et ce
  // stagiaire, pas un autre. Le vérifier ici évite d'enregistrer une ligne qui
  // pointerait vers un objet que le stagiaire ne pourrait pas relire.
  if (fichier && !fichier.chemin.startsWith(`${devoirId}/${moi.id}/`)) {
    throw new Error("Le fichier déposé ne correspond pas à ce devoir.");
  }

  const { error } = await supabase.from("devoirs_rendus").upsert(
    {
      devoir_id: devoirId,
      stagiaire_id: moi.id,
      contenu: contenu.trim() || null,
      fichier_chemin: fichier?.chemin ?? null,
      fichier_nom: fichier?.nom ?? null,
      fichier_taille: fichier?.taille ?? null,
      statut: remettre ? "rendu" : "brouillon",
      date_rendu: remettre ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "devoir_id,stagiaire_id" },
  );

  if (error) throw new Error(error.message);
  revalidatePath("/espace-stagiaire/devoirs");
}

export type RenduRecu = {
  id: string;
  stagiaire: string;
  statut: "brouillon" | "rendu";
  date_rendu: string | null;
  contenu: string | null;
  fichier: FichierRendu | null;
};

/**
 * Les rendus déposés sur un devoir, vus par le formateur.
 *
 * Le compte affiché sur la carte dit combien de copies sont arrivées ; il ne
 * dit pas de qui, ni ce qu'elles contiennent. Les policies ne renvoient que
 * les rendus des devoirs dont le formateur a le groupe.
 */
export async function getRendusDevoir(devoirId: string): Promise<RenduRecu[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("devoirs_rendus")
    .select(
      "id, statut, date_rendu, contenu, fichier_chemin, fichier_nom, fichier_taille, stagiaires(nom, prenom)",
    )
    .eq("devoir_id", devoirId)
    .order("date_rendu", { nullsFirst: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const r = row as unknown as {
      id: string;
      statut: "brouillon" | "rendu";
      date_rendu: string | null;
      contenu: string | null;
      fichier_chemin: string | null;
      fichier_nom: string | null;
      fichier_taille: number | null;
      stagiaires: { nom: string | null; prenom: string | null } | null;
    };
    return {
      id: r.id,
      stagiaire:
        [r.stagiaires?.prenom, r.stagiaires?.nom].filter(Boolean).join(" ") ||
        "Stagiaire",
      statut: r.statut,
      date_rendu: r.date_rendu,
      contenu: r.contenu,
      fichier: r.fichier_chemin
        ? {
            chemin: r.fichier_chemin,
            nom: r.fichier_nom ?? "rendu",
            taille: r.fichier_taille,
          }
        : null,
    };
  });
}

/**
 * Lien de téléchargement temporaire pour un rendu.
 *
 * Le bucket est privé : un chemin ne suffit pas à lire l'objet. La signature
 * est demandée sous la session de l'appelant, donc les policies décident —
 * le formateur du groupe et l'auteur du rendu, personne d'autre.
 */
export async function lienRendu(chemin: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(BUCKET_RENDUS)
    .createSignedUrl(chemin, 60 * 5);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Fichier introuvable.");
  }
  return data.signedUrl;
}
