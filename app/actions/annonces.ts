"use server";

import { createClient } from "@/lib/supabase/server";
import { envoyerCourriel } from "@/lib/courriel";
import { revalidatePath } from "next/cache";

export type Annonce = {
  id: string;
  groupe_id: string;
  titre: string;
  contenu: string | null;
  date: string | null;
  created_at: string;
};

export async function getAnnoncesByGroupe(groupeId: string): Promise<Annonce[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("annonces")
    .select("id, groupe_id, titre, contenu, date, created_at")
    .eq("groupe_id", groupeId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data as Annonce[];
}

async function notifyStagiaires(
  groupeId: string,
  annonce: { titre: string; contenu?: string | null },
) {
  const supabase = await createClient();

  const { data: groupe } = await supabase
    .from("groupes")
    .select("nom")
    .eq("id", groupeId)
    .single();

  const { data: stagiaires } = await supabase
    .from("stagiaires")
    .select("email, prenom, nom")
    .eq("groupe_id", groupeId)
    .not("email", "is", null);

  const emails = (stagiaires ?? [])
    .map((s) => s.email)
    .filter((e): e is string => Boolean(e));

  if (!emails.length) return;

  const text = [
    `Nouvelle annonce pour le groupe ${groupe?.nom ?? ""}:`,
    ``,
    annonce.titre,
    ``,
    annonce.contenu ?? "",
    ``,
    `— Pédago`,
  ].join("\n");

  // `envoyerCourriel` ne jette pas : elle rend l'échec. L'ancien décompte
  // portait sur les promesses rejetées, or `resend.emails.send()` tient la
  // sienne même quand l'API refuse — chaque échec était donc compté comme un
  // succès.
  const resultats = await Promise.all(
    emails.map((email) =>
      envoyerCourriel({
        a: email,
        sujet: `Annonce : ${annonce.titre}`,
        texte: text,
      }),
    ),
  );

  const echecs = resultats.filter((r) => !r.envoye);
  if (echecs.length > 0) {
    console.error(
      `[annonce] ${echecs.length} courriel(s) non parti(s) sur ${emails.length} :`,
      [...new Set(echecs.map((e) => (e.envoye ? "" : e.raison)))].join(" · "),
    );
  }
}

export async function createAnnonce(
  groupeId: string,
  input: { titre: string; contenu?: string; date?: string },
) {
  const supabase = await createClient();
  const { error } = await supabase.from("annonces").insert({
    groupe_id: groupeId,
    titre: input.titre,
    contenu: input.contenu || null,
    date: input.date || null,
  });

  if (error) throw new Error(error.message);

  await notifyStagiaires(groupeId, {
    titre: input.titre,
    contenu: input.contenu,
  }).catch((err) => console.error("Échec de notification:", err));

  revalidatePath(`/groupes/${groupeId}`);
  revalidatePath(`/groupes/${groupeId}/annonces`);
}

export async function deleteAnnonce(id: string, groupeId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("annonces").delete().eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath(`/groupes/${groupeId}/annonces`);
}
