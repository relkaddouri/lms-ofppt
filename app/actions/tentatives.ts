"use server";

import { createClient, getUser } from "@/lib/supabase/server";

/**
 * La trace d'une tentative de quiz (migration 101).
 *
 * Écrite à la fin du quiz, par le stagiaire lui-même. Elle ne change rien à
 * ce qu'il voit — le quiz reste non noté, rejouable — mais elle dit au
 * formateur qui s'entraîne, sur quoi, et quelles notions ne rentrent pas.
 *
 * Une tentative qui ne s'enregistre pas ne doit jamais casser le quiz : la
 * fonction avale son erreur. Perdre une ligne de statistique est sans
 * conséquence ; interrompre une révision par un message d'erreur en a une.
 */

export type ReponseTentative = {
  question: string;
  bonne: number;
  choisie: number;
  juste: boolean;
};

export async function enregistrerTentative(tentative: {
  genre: "chapitre" | "bilan";
  supportId?: string | null;
  moduleId?: string | null;
  rang?: number | null;
  justes: number;
  questions: number;
  reponses: ReponseTentative[];
  secondes?: number | null;
}): Promise<void> {
  try {
    const user = await getUser();
    if (!user) return;

    const supabase = await createClient();
    const { data: moi } = await supabase
      .from("stagiaires")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    // Un formateur qui essaie le quiz depuis un aperçu n'est pas un
    // stagiaire : il n'y a personne à suivre.
    if (!moi) return;

    await supabase.from("tentatives_quiz").insert({
      stagiaire_id: moi.id,
      genre: tentative.genre,
      support_id: tentative.supportId ?? null,
      module_id: tentative.moduleId ?? null,
      rang: tentative.rang ?? null,
      justes: tentative.justes,
      questions: tentative.questions,
      reponses: tentative.reponses as never,
      secondes: tentative.secondes ?? null,
    });
  } catch {
    // Silence volontaire : voir l'en-tête.
  }
}
