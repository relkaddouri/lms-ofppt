"use server";

import { createClient } from "@/lib/supabase/server";

export type GenreNotification =
  | "controle"
  | "question"
  | "copie"
  | "devoir"
  | "stage";

export type Notification = {
  id: string;
  genre: GenreNotification;
  /** Ce qui s'est passé, en une phrase. */
  texte: string;
  /** Élément mis en évidence dans la phrase : code de module, nom de groupe. */
  reference: string | null;
  /** Citation, quand la notification en porte une (question d'un stagiaire). */
  extrait: string | null;
  /** Auteur, quand c'est une personne — sert d'initiales à l'avatar. */
  auteur: string | null;
  date: string;
  href: string;
};

/**
 * Ce qui attend une action du formateur.
 *
 * Le projet n'a pas de table d'événements : ces entrées sont déduites de
 * l'état courant — un contrôle resté en brouillon, une question sans réponse,
 * une copie dont une question n'est pas notée. C'est ce qui explique
 * l'absence de « marquer comme lu » : il n'y a rien à marquer, seulement des
 * tâches qui disparaissent quand on les traite.
 */
export async function getNotifications(): Promise<Notification[]> {
  const supabase = await createClient();

  const [controlesRes, questionsRes, reponsesRes, copiesRes, rendusRes] =
    await Promise.all([
      supabase
        .from("controles")
        .select("id, titre, created_at, module_id, groupe_id, modules(competences(code_operationnel))")
        .eq("statut", "brouillon")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("questions_support")
        .select("id, texte, created_at, support_titre, module_id, groupe_id")
        .order("created_at", { ascending: false })
        .limit(40),
      supabase.from("reponses_question").select("question_id"),
      supabase
        .from("passations_controle")
        .select("id, nom_complet, note, responses, submitted_at, controle_id")
        .order("submitted_at", { ascending: false })
        .limit(40),
      supabase
        .from("devoirs_rendus")
        .select("id, date_rendu, statut, devoirs(titre)")
        .order("date_rendu", { ascending: false })
        .limit(20),
    ]);

  const notifications: Notification[] = [];

  for (const c of controlesRes.data ?? []) {
    const r = c as unknown as {
      id: string;
      titre: string | null;
      created_at: string;
      module_id: string;
      groupe_id: string;
      modules: { competences: { code_operationnel: string | null } | null } | null;
    };
    notifications.push({
      id: `controle-${r.id}`,
      genre: "controle",
      // Le titre d'un contrôle reprend déjà le nom du module : le rappeler
      // en référence donnait une ligne qui se répétait. Le code suffit.
      texte: `${r.titre ?? "Contrôle"} attend d'être validé`,
      reference: r.modules?.competences?.code_operationnel ?? null,
      extrait: null,
      auteur: null,
      date: r.created_at,
      href: `/modules/${r.module_id}/controle?groupe=${r.groupe_id}`,
    });
  }

  const repondues = new Set(
    (reponsesRes.data ?? []).map((r) => r.question_id as string),
  );
  for (const q of questionsRes.data ?? []) {
    const r = q as unknown as {
      id: string;
      texte: string;
      created_at: string;
      support_titre: string | null;
      module_id: string;
      groupe_id: string;
    };
    if (repondues.has(r.id)) continue;
    notifications.push({
      id: `question-${r.id}`,
      genre: "question",
      texte: "Une question de stagiaire attend une réponse",
      reference: r.support_titre,
      extrait: r.texte,
      auteur: null,
      date: r.created_at,
      href: `/groupes/${r.groupe_id}/progression`,
    });
  }

  for (const p of copiesRes.data ?? []) {
    const r = p as unknown as {
      id: string;
      nom_complet: string;
      note: number | null;
      responses: { points: number | null }[] | null;
      submitted_at: string;
      controle_id: string;
    };
    // Une copie n'est en attente que si au moins une question n'est pas notée.
    const incomplete = (r.responses ?? []).some(
      (d) => d.points === null || d.points === undefined,
    );
    if (!incomplete) continue;
    notifications.push({
      id: `copie-${r.id}`,
      genre: "copie",
      texte: `${r.nom_complet} a rendu une copie à corriger`,
      reference: null,
      extrait: null,
      auteur: r.nom_complet,
      date: r.submitted_at,
      href: `/modules`,
    });
  }

  for (const d of rendusRes.data ?? []) {
    const r = d as unknown as {
      id: string;
      date_rendu: string | null;
      statut: string | null;
      devoirs: { titre: string } | null;
    };
    if (r.statut === "corrige" || !r.date_rendu) continue;
    notifications.push({
      id: `devoir-${r.id}`,
      genre: "devoir",
      texte: "Un devoir a été rendu",
      reference: r.devoirs?.titre ?? null,
      extrait: null,
      auteur: null,
      date: r.date_rendu,
      href: `/groupes`,
    });
  }

  return notifications.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 40);
}
