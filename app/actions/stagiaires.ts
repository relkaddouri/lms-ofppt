"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { revalidatePath } from "next/cache";

export type Stagiaire = {
  id: string;
  nom: string;
  prenom: string;
  email: string | null;
  /** Code d'Enregistrement du Formé — l'identifiant OFPPT du stagiaire. */
  cef: string | null;
  /** Code National de l'Étudiant, réclamé par les pièces officielles. */
  cne: string | null;
  /** Chemin de la photo dans le bucket, nul tant qu'il n'y en a pas. */
  photo: string | null;
  groupe_id: string;
  /** Compte du stagiaire ; nul tant qu'il n'a pas été invité. */
  user_id: string | null;
};

/**
 * `photo` et sa fonction, en attendant les types regénérés (migration 081).
 *
 * La colonne et la fonction existent dans la migration mais pas encore dans
 * `database.types.ts`, qui se régénère après `supabase db push`. Les deux
 * béquilles sont isolées ici — deux lignes à retirer ce jour-là — plutôt que
 * des casts dispersés qui éteindraient le typage sur des requêtes entières.
 */
type AppelRpc = (nom: string, args: Record<string, unknown>) => Promise<{
  error: { message: string } | null;
}>;

export async function getStagiairesByGroupe(
  groupeId: string,
): Promise<Stagiaire[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stagiaires")
    .select("id, nom, prenom, email, cef, cne, photo, groupe_id, user_id")
    .eq("groupe_id", groupeId)
    .order("nom");

  if (error) throw new Error(error.message);
  return data as unknown as Stagiaire[];
}

export async function getStagiairesCount(groupeId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("stagiaires")
    .select("id", { count: "exact", head: true })
    .eq("groupe_id", groupeId);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Le CEF est unique : un doublon mérite mieux qu'un message de Postgres. */
function messageCef(message: string): string {
  return message.includes("stagiaires_cef_unique")
    ? "Ce CEF est déjà attribué à un autre stagiaire."
    : message;
}

export async function addStagiaire(
  groupeId: string,
  input: {
    nom: string;
    prenom: string;
    email?: string;
    cef?: string;
    cne?: string;
  },
) {
  const supabase = await createClient();
  const { error } = await supabase.from("stagiaires").insert({
    groupe_id: groupeId,
    nom: input.nom,
    prenom: input.prenom,
    email: input.email?.trim() || null,
    cef: input.cef?.trim() || null,
    cne: input.cne?.trim() || null,
  });

  if (error) throw new Error(messageCef(error.message));
  revalidatePath(`/groupes/${groupeId}`);
}

/**
 * Modifie un stagiaire — et renomme son compte si son adresse change.
 *
 * Changer d'adresse est un geste courant : un stagiaire perd l'accès à sa
 * boîte et en donne une autre. Or l'adresse vit à deux endroits. Sur la fiche,
 * elle sert à afficher et à écrire. Sur le compte d'authentification, elle
 * *est* l'identifiant : c'est elle que Supabase reconnaît, et c'est à elle que
 * les liens d'accès sont émis.
 *
 * Écrire seulement la fiche laissait les deux diverger en silence. Le lien
 * suivant était alors demandé pour une adresse sans compte, et l'invitation
 * échouait sans que rien n'ait prévenu. Le compte suit donc la fiche.
 *
 * L'échec du renommage est rendu et non jeté : ce qu'une Server Action jette
 * est masqué en production, et un avertissement masqué ne vaut rien.
 */
export async function updateStagiaire(
  id: string,
  groupeId: string,
  input: {
    nom: string;
    prenom: string;
    email?: string;
    cef?: string;
    cne?: string;
  },
): Promise<{ avertissement?: string }> {
  const supabase = await createClient();

  // Lue avant l'écriture, sous l'identité du formateur : si la policy lui
  // refuse ce stagiaire, il n'y a rien à renommer non plus.
  const { data: avant } = await supabase
    .from("stagiaires")
    .select("email, user_id")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase
    .from("stagiaires")
    .update({
      nom: input.nom,
      prenom: input.prenom,
      email: input.email?.trim() || null,
      cef: input.cef?.trim() || null,
      cne: input.cne?.trim() || null,
    })
    .eq("id", id);

  if (error) throw new Error(messageCef(error.message));

  let avertissement: string | undefined;
  const nouvelle = input.email?.trim().toLowerCase() || null;

  // La comparaison porte sur l'adresse du compte, et non sur celle que la
  // fiche portait avant. C'est ce qui permet de réparer un écart déjà installé
  // en réenregistrant simplement la fiche : comparer les deux états de la
  // fiche ne verrait aucun changement, et laisserait le compte de travers.
  if (avant?.user_id && nouvelle) {
    const service = createServiceClient();
    const { data: compte } = await service.auth.admin.getUserById(
      avant.user_id,
    );
    const adresseDuCompte = compte?.user?.email?.toLowerCase() ?? null;

    if (adresseDuCompte && adresseDuCompte !== nouvelle) {
      // `email_confirm` : le formateur atteste l'adresse, comme à la création
      // du compte. Sans lui, le stagiaire resterait bloqué sur une
      // confirmation envoyée à une boîte qu'il ne peut justement plus ouvrir.
      const { error: errRenommage } = await service.auth.admin.updateUserById(
        avant.user_id,
        { email: nouvelle, email_confirm: true },
      );
      if (errRenommage) {
        avertissement = `La fiche est à jour, mais son compte est resté à ${adresseDuCompte} : ${errRenommage.message}`;
      }
    }
  }

  revalidatePath(`/groupes/${groupeId}`);
  return { avertissement };
}

export async function removeStagiaire(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("stagiaires").delete().eq("id", id);

  if (error) throw new Error(error.message);
}

export type StagiaireImportRow = {
  nom: string;
  prenom: string;
  email: string | null;
  cef: string | null;
  cne: string | null;
};

export async function bulkImportStagiaires(
  groupeId: string,
  rows: StagiaireImportRow[],
): Promise<{ imported: number }> {
  const supabase = await createClient();

  if (!rows.length) return { imported: 0 };

  const { error } = await supabase.from("stagiaires").insert(
    rows.map((row) => ({
      groupe_id: groupeId,
      nom: row.nom,
      prenom: row.prenom,
      email: row.email ?? null,
      cef: row.cef ?? null,
      cne: row.cne ?? null,
    })),
  );

  if (error) throw new Error(error.message);
  revalidatePath(`/groupes/${groupeId}`);
  return { imported: rows.length };
}

/**
 * Enregistre la photo d'un stagiaire, une fois le fichier déposé.
 *
 * L'écriture passe par une fonction et non par un `update` : la policy de
 * `stagiaires` réserve l'écriture au formateur, si bien qu'un stagiaire
 * pourrait déposer son fichier sans jamais pouvoir l'inscrire sur sa fiche.
 * La fonction ne touche que la colonne `photo` — un stagiaire ne se renomme
 * pas, ne change pas de groupe et ne se donne pas un CEF.
 *
 * Le dépôt du fichier lui-même se fait depuis le navigateur, directement vers
 * le stockage : faire transiter deux mégaoctets par une Server Action pour
 * les réémettre ensuite n'ajouterait qu'une latence.
 */
export async function enregistrerPhoto(
  stagiaireId: string,
  chemin: string | null,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await (supabase.rpc as unknown as AppelRpc)(
    "enregistrer_photo_stagiaire",
    { p_stagiaire: stagiaireId, p_chemin: chemin },
  );
  if (error) throw new Error(error.message);

  revalidatePath("/groupes");
  revalidatePath("/espace-stagiaire", "layout");
}
