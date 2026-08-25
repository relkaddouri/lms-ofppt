"use server";

import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";
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
    .select("*")
    .eq("groupe_id", groupeId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data as Annonce[];
}

async function notifyStagiaires(
  groupeId: string,
  annonce: { titre: string; contenu?: string | null },
) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? "LMS OFPPT <onboarding@resend.dev>";
  if (!apiKey) return;

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

  const resend = new Resend(apiKey);

  const text = [
    `Nouvelle annonce pour le groupe ${groupe?.nom ?? ""}:`,
    ``,
    annonce.titre,
    ``,
    annonce.contenu ?? "",
    ``,
    `— LMS OFPPT`,
  ].join("\n");

  const results = await Promise.allSettled(
    emails.map((email) =>
      resend.emails.send({
        from,
        to: email,
        subject: `Annonce : ${annonce.titre}`,
        text,
      }),
    ),
  );

  const failures = results.filter((r) => r.status === "rejected").length;
  if (failures > 0) {
    console.error(`${failures} email(s) non envoyé(s).`);
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
