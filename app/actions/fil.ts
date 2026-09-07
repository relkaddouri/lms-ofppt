"use server";

import { createClient, getUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type Commentaire = {
  id: string;
  texte: string;
  created_at: string;
  auteurNom: string;
  /** Vrai si l'auteur est le formateur du groupe et non un stagiaire. */
  auteurFormateur: boolean;
  estMien: boolean;
};

export type AnnonceFil = {
  id: string;
  titre: string | null;
  contenu: string | null;
  date: string | null;
  created_at: string;
  jaime: number;
  jaimePersonnel: boolean;
  commentaires: Commentaire[];
};

/** Camarade mentionnable, pour l'autocomplétion. */
export type Camarade = { id: string; nom: string };

export async function getFil(groupeId: string): Promise<AnnonceFil[]> {
  const supabase = await createClient();
  const user = await getUser();

  const { data: annonces, error } = await supabase
    .from("annonces")
    .select("id, titre, contenu, date, created_at")
    .eq("groupe_id", groupeId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  if (!annonces || annonces.length === 0) return [];

  const ids = annonces.map((a) => a.id);

  // Trois requêtes groupées plutôt qu'une paire par annonce
  // (conventions.md L.53).
  const [reactionsRes, commentairesRes, stagiairesRes] = await Promise.all([
    supabase.from("reactions_annonce").select("annonce_id, user_id").in("annonce_id", ids),
    supabase
      .from("commentaires_annonce")
      .select("id, annonce_id, auteur_id, texte, created_at")
      .in("annonce_id", ids)
      .order("created_at"),
    supabase.from("stagiaires").select("user_id, nom, prenom").eq("groupe_id", groupeId),
  ]);

  if (reactionsRes.error) throw new Error(reactionsRes.error.message);
  if (commentairesRes.error) throw new Error(commentairesRes.error.message);

  // Un auteur sans fiche stagiaire est le formateur : c'est le seul autre
  // compte qui accède au groupe.
  const nomsParCompte = new Map<string, string>();
  for (const s of stagiairesRes.data ?? []) {
    if (s.user_id) nomsParCompte.set(s.user_id, `${s.prenom} ${s.nom}`);
  }

  return annonces.map((a) => {
    const reactions = (reactionsRes.data ?? []).filter((r) => r.annonce_id === a.id);
    return {
      id: a.id,
      titre: a.titre,
      contenu: a.contenu,
      date: a.date,
      created_at: a.created_at,
      jaime: reactions.length,
      jaimePersonnel: reactions.some((r) => r.user_id === user?.id),
      commentaires: (commentairesRes.data ?? [])
        .filter((c) => c.annonce_id === a.id)
        .map((c) => ({
          id: c.id,
          texte: c.texte,
          created_at: c.created_at,
          auteurNom: nomsParCompte.get(c.auteur_id) ?? "Formateur",
          auteurFormateur: !nomsParCompte.has(c.auteur_id),
          estMien: c.auteur_id === user?.id,
        })),
    };
  });
}

export async function getCamarades(groupeId: string): Promise<Camarade[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stagiaires")
    .select("id, nom, prenom")
    .eq("groupe_id", groupeId)
    .order("prenom");

  if (error) throw new Error(error.message);
  return (data ?? []).map((s) => ({ id: s.id, nom: `${s.prenom} ${s.nom}` }));
}

export async function basculerJaime(annonceId: string, aimer: boolean) {
  const user = await getUser();
  if (!user) throw new Error("Authentification requise.");

  const supabase = await createClient();
  const { error } = aimer
    ? await supabase
        .from("reactions_annonce")
        .upsert(
          { annonce_id: annonceId, user_id: user.id },
          { onConflict: "annonce_id,user_id" },
        )
    : await supabase
        .from("reactions_annonce")
        .delete()
        .eq("annonce_id", annonceId)
        .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/espace-stagiaire/fil");
}

/**
 * `cheminARevalider` : le fil vit maintenant aussi sur l'écran d'annonces du
 * formateur. Revalider le seul chemin stagiaire y laisserait une page servie
 * depuis le cache, sans le commentaire qui vient d'être écrit.
 */
export async function commenter(
  annonceId: string,
  texte: string,
  cheminARevalider?: string,
) {
  const propre = texte.trim();
  if (!propre) throw new Error("Le commentaire est vide.");
  if (propre.length > 2000) {
    throw new Error("Le commentaire dépasse 2000 caractères.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("commentaires_annonce")
    .insert({ annonce_id: annonceId, texte: propre });

  if (error) throw new Error(error.message);
  revalidatePath("/espace-stagiaire/fil");
  if (cheminARevalider) revalidatePath(cheminARevalider);
}

export async function supprimerCommentaire(
  id: string,
  cheminARevalider?: string,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("commentaires_annonce")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/espace-stagiaire/fil");
  if (cheminARevalider) revalidatePath(cheminARevalider);
}
