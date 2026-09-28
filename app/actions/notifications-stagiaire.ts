"use server";

import { createClient } from "@/lib/supabase/server";
import type { Notification } from "@/app/actions/notifications";
import { getIdentiteFormateur } from "@/app/actions/profil";

/**
 * Ce qui vient de se passer dans le groupe du stagiaire (PRD §4.5).
 *
 * Le pendant de `getNotifications`, pour l'autre espace — et son contraire
 * dans l'esprit. Celles du formateur listent ce qui attend une action, et
 * disparaissent quand il l'a faite. Celles-ci listent ce qui est arrivé :
 * une annonce, un commentaire, une réponse à une question. Rien n'attend le
 * stagiaire, rien ne se résout, donc rien ne s'efface — la liste est bornée
 * dans le temps plutôt que par un état.
 *
 * Quatorze jours : au-delà, ce n'est plus une nouvelle, c'est l'historique du
 * fil, qui se consulte dans le fil.
 */
const JOURS = 14;

export async function getNotificationsStagiaire(): Promise<Notification[]> {
  const supabase = await createClient();

  const { data: utilisateur } = await supabase.auth.getUser();
  if (!utilisateur.user) return [];

  const { data: moi } = await supabase
    .from("stagiaires")
    .select("id, groupe_id")
    .eq("user_id", utilisateur.user.id)
    .maybeSingle();
  if (!moi?.groupe_id) return [];

  const depuis = new Date(
    Date.now() - JOURS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [annoncesRes, commentairesRes, reponsesRes, testsRes, camaradesRes, formateur] =
    await Promise.all([
    supabase
      .from("annonces")
      .select("id, titre, created_at")
      .eq("groupe_id", moi.groupe_id)
      .gte("created_at", depuis)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("commentaires_annonce")
      .select("id, texte, created_at, auteur_id, annonces!inner(titre, groupe_id)")
      .eq("annonces.groupe_id", moi.groupe_id)
      .gte("created_at", depuis)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("reponses_question")
      .select(
        "id, texte, created_at, auteur_id, questions_support!inner(id, support_titre, support_id, groupe_id)",
      )
      .eq("questions_support.groupe_id", moi.groupe_id)
      .gte("created_at", depuis)
      .order("created_at", { ascending: false })
      .limit(20),
    // Un contrôle de test qu'on vient d'ouvrir au groupe (PRD §4.7bis) : c'est
    // la seule façon pour le stagiaire de l'apprendre sans qu'on le lui dise.
    supabase
      .from("controles")
      .select("id, titre, ouvert_le, ferme_le")
      .eq("groupe_id", moi.groupe_id)
      .eq("type", "TEST")
      .gte("ouvert_le", depuis)
      .order("ouvert_le", { ascending: false })
      .limit(10),
    // Qui a écrit : le nom et le visage de ses camarades, dans le seul groupe
    // auquel il accède.
    supabase
      .from("stagiaires")
      .select("user_id, nom, prenom, photo")
      .eq("groupe_id", moi.groupe_id)
      .not("user_id", "is", null)
      .limit(60),
    getIdentiteFormateur(),
  ]);

  // Un auteur sans fiche de camarade est le formateur : c'est le seul autre
  // compte qui accède au groupe. Sa photo vit dans un autre seau, d'où
  // l'adresse déjà résolue plutôt qu'un chemin.
  const camarades = new Map<string, { nom: string; photo: string | null }>();
  for (const c of camaradesRes.data ?? []) {
    if (c.user_id) {
      camarades.set(c.user_id, { nom: `${c.prenom} ${c.nom}`, photo: c.photo });
    }
  }
  const qui = (auteurId: string) => camarades.get(auteurId);

  const notifications: Notification[] = [];

  for (const a of annoncesRes.data ?? []) {
    notifications.push({
      id: `annonce-${a.id}`,
      genre: "commentaire",
      texte: `${formateur.nom ?? "Votre formateur"} a publié une annonce`,
      reference: a.titre,
      extrait: null,
      auteur: formateur.nom,
      auteurPhotoUrl: formateur.photoUrl,
      auteurPhoto: null,
      date: a.created_at,
      href: "/espace-stagiaire/fil",
    });
  }

  // Ses propres mots ne lui sont pas annoncés : il sait ce qu'il a écrit.
  for (const c of commentairesRes.data ?? []) {
    if (c.auteur_id === utilisateur.user.id) continue;
    notifications.push({
      id: `commentaire-${c.id}`,
      genre: "commentaire",
      texte: `${qui(c.auteur_id)?.nom ?? formateur.nom ?? "Votre formateur"} a commenté une annonce`,
      reference: c.annonces?.titre ?? null,
      extrait: c.texte,
      auteur: qui(c.auteur_id)?.nom ?? formateur.nom,
      auteurPhoto: qui(c.auteur_id)?.photo ?? null,
      auteurPhotoUrl: qui(c.auteur_id) ? null : formateur.photoUrl,
      date: c.created_at,
      // Jusqu'au commentaire : le fil du stagiaire en porte l'ancre.
      href: `/espace-stagiaire/fil#commentaire-${c.id}`,
    });
  }

  for (const r of reponsesRes.data ?? []) {
    if (r.auteur_id === utilisateur.user.id) continue;
    const question = r.questions_support;
    notifications.push({
      id: `reponse-${r.id}`,
      genre: "question",
      texte: `${qui(r.auteur_id)?.nom ?? formateur.nom ?? "Votre formateur"} a répondu à une question`,
      reference: question?.support_titre ?? null,
      extrait: r.texte,
      auteur: qui(r.auteur_id)?.nom ?? formateur.nom,
      auteurPhoto: qui(r.auteur_id)?.photo ?? null,
      auteurPhotoUrl: qui(r.auteur_id) ? null : formateur.photoUrl,
      date: r.created_at,
      href: question?.support_id
        ? `/espace-stagiaire/cours/${question.support_id}#question-${question.id}`
        : "/espace-stagiaire/cours",
    });
  }

  for (const t of testsRes.data ?? []) {
    if (!t.ouvert_le) continue;
    notifications.push({
      id: `test-${t.id}-${t.ouvert_le}`,
      genre: "commentaire",
      texte: "Un contrôle de test est ouvert",
      reference: t.titre,
      extrait: t.ferme_le
        ? "Chronométré : il se ferme à une heure fixée par votre formateur."
        : null,
      auteur: formateur.nom,
      auteurPhotoUrl: formateur.photoUrl,
      auteurPhoto: null,
      date: t.ouvert_le,
      href: `/espace-stagiaire/controles/${t.id}`,
    });
  }

  return notifications
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 40);
}
