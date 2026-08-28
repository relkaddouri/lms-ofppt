"use server";

import { createClient, getUser } from "@/lib/supabase/server";

export type IdentiteStagiaire = {
  stagiaireId: string;
  nom: string;
  prenom: string;
  groupeId: string;
  groupeNom: string;
};

/**
 * Identité du stagiaire connecté.
 *
 * Renvoie null pour un formateur : c'est ce qui permet à chaque espace de
 * rediriger vers l'autre plutôt que d'afficher une page vide.
 */
export async function getIdentiteStagiaire(): Promise<IdentiteStagiaire | null> {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stagiaires")
    .select("id, nom, prenom, groupe_id, groupes(nom)")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return null;

  const s = data as unknown as {
    id: string;
    nom: string;
    prenom: string;
    groupe_id: string;
    groupes: { nom: string } | null;
  };

  return {
    stagiaireId: s.id,
    nom: s.nom,
    prenom: s.prenom,
    groupeId: s.groupe_id,
    groupeNom: s.groupes?.nom ?? "—",
  };
}
