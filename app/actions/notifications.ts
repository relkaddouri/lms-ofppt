"use server";

import { createClient } from "@/lib/supabase/server";

export type GenreNotification =
  | "controle"
  | "question"
  | "commentaire"
  | "jaime"
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
 * Ce qui attend une action du formateur, et ce qui vient de se passer.
 *
 * Le projet n'a pas de table d'événements : ces entrées sont déduites de
 * l'état courant — un contrôle resté en brouillon, une question sans réponse,
 * une copie dont une question n'est pas notée. C'est ce qui explique
 * l'absence de « marquer comme lu » : il n'y a rien à marquer, seulement des
 * tâches qui disparaissent quand on les traite.
 *
 * Les « j'aime » font exception et l'assument. Ils n'appellent aucune action
 * et ne disparaîtront donc jamais d'eux-mêmes : ils sont bornés aux plus
 * récents, et rangés après le reste. Le formateur voulait savoir que sa classe
 * réagit ; le taire au motif que ce n'est pas une tâche revenait à décider
 * pour lui de ce qui l'intéresse.
 */
export async function getNotifications(): Promise<Notification[]> {
  const supabase = await createClient();

  const [
    controlesRes,
    questionsRes,
    publieesRes,
    enAttenteRes,
    copiesRes,
    rendusRes,
  ] = await Promise.all([
      supabase
        .from("controles")
        .select(
          "id, titre, created_at, module_id, groupe_id, modules(competences(code_operationnel))",
        )
        .eq("statut", "brouillon")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("questions_support")
        .select(
          "id, texte, created_at, statut, support_titre, module_id, groupe_id, supports_seance(seance_id)",
        )
        .order("created_at", { ascending: false })
        .limit(40),
      // Les réponses servent deux fois, et les deux usages n'ont pas besoin
      // des mêmes colonnes : savoir quelles questions sont déjà répondues ne
      // demande que des identifiants. Une seule lecture sans limite les
      // rapportait toutes, texte compris, et grossissait à chaque réponse
      // écrite depuis le début de l'année (migration 085).
      supabase
        .from("reponses_question")
        .select("question_id")
        .eq("statut", "publiee")
        .limit(1000),
      supabase
        .from("reponses_question")
        .select(
          "id, question_id, texte, created_at, statut, questions_support(support_titre, groupe_id, supports_seance(seance_id))",
        )
        .eq("statut", "en_attente")
        .order("created_at", { ascending: false })
        .limit(40),
      // La vue `v_copies_a_corriger` (migration 103) ne rend que les copies
      // dont une question reste à noter. Demander `responses` pour faire ce
      // test ici transportait 343 Ko à chaque vérification, toutes les cinq
      // minutes, pour les jeter aussitôt.
      supabase
        .from("v_copies_a_corriger")
        .select("id, nom_complet, submitted_at, controle_id")
        .order("submitted_at", { ascending: false })
        .limit(40),
      supabase
        .from("devoirs_rendus")
        .select("id, date_rendu, statut, devoirs(titre)")
        .order("date_rendu", { ascending: false })
        .limit(20),
    ]);

  // Les réactions du fil se lisent à part : elles ne dépendent d'aucune des
  // cinq lectures ci-dessus et n'ont pas à les retarder si elles échouent.
  const [commentairesRes, reactionsRes, comptesStagiairesRes] =
    await Promise.all([
      supabase
        .from("commentaires_annonce")
        .select(
          "id, annonce_id, auteur_id, texte, created_at, annonces(titre, groupe_id)",
        )
        .order("created_at", { ascending: false })
        .limit(60),
      supabase
        .from("reactions_annonce")
        .select("annonce_id, user_id, created_at, annonces(titre, groupe_id)")
        .order("created_at", { ascending: false })
        .limit(30),
      // Qui est stagiaire ? La question se pose à `stagiaires` et non à
      // `profils` : la policy de `profils` ne rend au formateur que sa propre
      // ligne — `profils_lecture_crochet_jeton` est réservée au crochet de
      // jeton, donc à `supabase_auth_admin`. L'ensemble revenait vide, et comme
      // il sert de filtre, **aucun commentaire ni aucun j'aime n'a jamais été
      // notifié**. `stagiaires` répond mieux à la question posée : est stagiaire
      // celui qui est inscrit dans un des groupes du formateur.
      supabase.from("stagiaires").select("user_id").not("user_id", "is", null),
    ]);

  const notifications: Notification[] = [];

  for (const c of controlesRes.data ?? []) {
    const r = c as unknown as {
      id: string;
      titre: string | null;
      created_at: string;
      module_id: string;
      groupe_id: string;
      modules: {
        competences: { code_operationnel: string | null } | null;
      } | null;
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

  // Une réponse en attente ne répond encore à rien : le groupe ne la voit
  // pas. Seules les publiées retirent une question de la liste.
  const repondues = new Set(
    (publieesRes.data ?? []).map((r) => r.question_id as string),
  );
  for (const q of questionsRes.data ?? []) {
    const r = q as unknown as {
      id: string;
      texte: string;
      created_at: string;
      statut: string;
      support_titre: string | null;
      module_id: string;
      groupe_id: string;
      supports_seance: { seance_id: string } | null;
    };
    const aValider = r.statut === "en_attente";
    if (!aValider && repondues.has(r.id)) continue;
    notifications.push({
      id: `question-${r.id}`,
      genre: "question",
      // Deux travaux distincts, qu'on ne confond pas : trancher si le message
      // a sa place, ou y répondre.
      texte: aValider
        ? "Une question de stagiaire attend votre validation"
        : "Une question de stagiaire attend une réponse",
      reference: r.support_titre,
      extrait: r.texte,
      auteur: null,
      date: r.created_at,
      // La question vit dans l'onglet Support de sa séance. Pointer la
      // progression obligeait à la retrouver soi-même, alors que la
      // notification sait exactement où elle est.
      href: r.supports_seance?.seance_id
        ? `/groupes/${r.groupe_id}/seances/${r.supports_seance.seance_id}?onglet=support#question-${r.id}`
        : `/groupes/${r.groupe_id}/progression`,
    });
  }

  type ReponseLue = {
    id: string;
    question_id: string;
    texte: string;
    created_at: string;
    statut: string;
    questions_support: {
      support_titre: string | null;
      groupe_id: string | null;
      supports_seance: { seance_id: string } | null;
    } | null;
  };
  // La lecture est déjà bornée aux réponses en attente : le filtre est en
  // base, il n'a plus à être refait ici.
  for (const r of (enAttenteRes.data ?? []) as unknown as ReponseLue[]) {
    const q = r.questions_support;
    notifications.push({
      id: `reponse-${r.id}`,
      genre: "question",
      texte: "Une réponse de stagiaire attend votre validation",
      reference: q?.support_titre ?? null,
      extrait: r.texte,
      auteur: null,
      date: r.created_at,
      href:
        q?.groupe_id && q.supports_seance?.seance_id
          ? `/groupes/${q.groupe_id}/seances/${q.supports_seance.seance_id}?onglet=support#question-${r.question_id}`
          : "/groupes",
    });
  }

  // ── Le fil : commentaires en attente, puis réactions ────────────────────
  //
  // La règle du commentaire en attente est celle du tableau de bord : on
  // compare par fil et par date. Un formateur qui a répondu une fois à la fin
  // d'une discussion y a répondu, même si trois commentaires l'ont précédé.
  const stagiaires = new Set(
    (comptesStagiairesRes.data ?? [])
      .map((s) => s.user_id)
      .filter((id): id is string => id !== null),
  );

  type CommentaireLu = {
    id: string;
    annonce_id: string;
    auteur_id: string;
    texte: string;
    created_at: string;
    annonces: { titre: string | null; groupe_id: string } | null;
  };
  const commentaires = (commentairesRes.data ??
    []) as unknown as CommentaireLu[];

  const dernierMotDuFormateur = new Map<string, string>();
  for (const c of commentaires) {
    if (stagiaires.has(c.auteur_id)) continue;
    const vue = dernierMotDuFormateur.get(c.annonce_id);
    if (!vue || c.created_at > vue) {
      dernierMotDuFormateur.set(c.annonce_id, c.created_at);
    }
  }

  for (const c of commentaires) {
    if (!stagiaires.has(c.auteur_id)) continue;
    const repondu = dernierMotDuFormateur.get(c.annonce_id);
    if (repondu && c.created_at <= repondu) continue;
    notifications.push({
      id: `commentaire-${c.id}`,
      genre: "commentaire",
      texte: "Un stagiaire a commenté une annonce",
      reference: c.annonces?.titre ?? null,
      extrait: c.texte,
      auteur: null,
      date: c.created_at,
      // Jusqu'au commentaire, non jusqu'à la page : un fil de dix-sept
      // réponses ne se parcourt pas pour retrouver celle qui a sonné.
      href: c.annonces?.groupe_id
        ? `/groupes/${c.annonces.groupe_id}/annonces#commentaire-${c.id}`
        : "/groupes",
    });
  }

  // Les « j'aime » se groupent par annonce : quinze lignes identiques pour un
  // même billet noieraient tout le reste du panneau.
  type ReactionLue = {
    annonce_id: string;
    /** `user_id` et non `auteur_id` : la table des réactions nomme ainsi. */
    user_id: string;
    created_at: string;
    annonces: { titre: string | null; groupe_id: string } | null;
  };
  const parAnnonce = new Map<
    string,
    {
      nombre: number;
      date: string;
      titre: string | null;
      groupe: string | null;
    }
  >();
  for (const r of (reactionsRes.data ?? []) as unknown as ReactionLue[]) {
    if (!stagiaires.has(r.user_id)) continue;
    const vue = parAnnonce.get(r.annonce_id);
    if (vue) {
      vue.nombre += 1;
      if (r.created_at > vue.date) vue.date = r.created_at;
    } else {
      parAnnonce.set(r.annonce_id, {
        nombre: 1,
        date: r.created_at,
        titre: r.annonces?.titre ?? null,
        groupe: r.annonces?.groupe_id ?? null,
      });
    }
  }
  for (const [annonceId, r] of parAnnonce) {
    notifications.push({
      id: `jaime-${annonceId}`,
      genre: "jaime",
      texte:
        r.nombre > 1
          ? `${r.nombre} stagiaires ont aimé une annonce`
          : "Un stagiaire a aimé une annonce",
      reference: r.titre,
      extrait: null,
      auteur: null,
      date: r.date,
      href: r.groupe ? `/groupes/${r.groupe}/annonces` : "/groupes",
    });
  }

  // La vue ne rend que les copies qui attendent : la règle « au moins une
  // question non notée » est appliquée en base, à l'identique.
  for (const p of copiesRes.data ?? []) {
    const r = p as unknown as {
      id: string;
      nom_complet: string;
      submitted_at: string;
      controle_id: string;
    };
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

  // Les « j'aime » passent après tout le reste à date égale : ils
  // n'appellent aucune action, et les laisser remonter en tête repousserait
  // hors du panneau ce qui en attend une.
  const rang = (n: Notification) => (n.genre === "jaime" ? 1 : 0);
  return notifications
    .sort((a, b) => rang(a) - rang(b) || b.date.localeCompare(a.date))
    .slice(0, 40);
}
