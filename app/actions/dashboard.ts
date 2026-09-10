"use server";

import { createClient } from "@/lib/supabase/server";
import { getProgressionTousGroupes } from "@/app/actions/progression";
import { getPeriodesGroupes } from "@/app/actions/groupes";
import { cumule } from "@/lib/progression";
import { maintenant } from "@/lib/format";
import { getPortee } from "@/app/actions/annees";

export type GroupeProgression = {
  id: string;
  nom: string;
  date_fin: string | null;
  heuresRealisees: number;
  masseHoraire: number;
  pourcentage: number;
  /** Séances faites sans durée saisie : elles minorent le cumul. */
  seancesSansDuree: number;
};

export type EvolutionPoint = {
  date: string;
  label: string;
  /** Progression réelle : heures dispensées sur masse horaire totale, en %. */
  realise: number;
  /** Progression attendue à cette date d'après les séances planifiées, en %. */
  previsionnel: number;
};

export type Evolution = {
  points: EvolutionPoint[];
  /** Progression atteinte au dernier point. */
  actuel: number;
  /** Points de pourcentage gagnés sur la période affichée. */
  gain: number;
};

export type DashboardStats = {
  totalStagiaires: number;
  groupesActifs: number;
  modulesCount: number;
  controlesEnAttente: number;
};

export async function getDashboardData(): Promise<{
  stats: DashboardStats;
  groupes: GroupeProgression[];
  evolution: Evolution;
}> {
  const supabase = await createClient();

  // PRD §4.15 : le tableau de bord ne compte que l'année sélectionnée. Sans
  // cette borne, les stagiaires et les séances de toutes les années passées
  // s'additionneraient dans les mêmes compteurs.
  const { groupeIds } = await getPortee();

  const [groupesRes, seancesRes, stagiairesRes, modulesRes, controlesRes] =
    await Promise.all([
      supabase.from("groupes").select("id, nom").in("id", groupeIds),
      supabase
        .from("seances")
        .select(
          "statut, date, duree_prevue, duree_realisee, updated_at, created_at, seance_groupes!inner(groupe_id)",
        )
        .in("seance_groupes.groupe_id", groupeIds),
      supabase
        .from("stagiaires")
        .select("id", { count: "exact", head: true })
        .in("groupe_id", groupeIds),
      // Les modules sont du référentiel : permanents et partagés entre les
      // années (PRD §4.15), leur compte ne se borne pas.
      supabase.from("modules").select("id", { count: "exact", head: true }),
      supabase
        .from("controles")
        .select("id", { count: "exact", head: true })
        .eq("statut", "brouillon")
        .in("groupe_id", groupeIds),
    ]);

  if (groupesRes.error) throw new Error(groupesRes.error.message);
  if (seancesRes.error) throw new Error(seancesRes.error.message);
  if (stagiairesRes.error) throw new Error(stagiairesRes.error.message);
  if (modulesRes.error) throw new Error(modulesRes.error.message);
  if (controlesRes.error) throw new Error(controlesRes.error.message);

  const groupes = groupesRes.data;
  const seances = seancesRes.data;

  const today = maintenant();
  // La fin d'un groupe n'est plus saisie : elle se lit sur sa dernière séance
  // datée (PRD §4.9). Un groupe sans séance datée reste actif.
  const periodes = await getPeriodesGroupes();
  const finDe = (id: string) => periodes.get(id)?.fin ?? null;

  const stats: DashboardStats = {
    totalStagiaires: stagiairesRes.count ?? 0,
    groupesActifs: groupes.filter((g) => {
      const fin = finDe(g.id);
      return !fin || fin >= today;
    }).length,
    modulesCount: modulesRes.count ?? 0,
    controlesEnAttente: controlesRes.count ?? 0,
  };

  // La progression se mesure en heures dispensées sur la masse horaire
  // allouée au groupe, pas en nombre de séances cochées.
  const progression = await getProgressionTousGroupes();

  const groupesProgression: GroupeProgression[] = groupes.map((g) => {
    const total = cumule(progression.filter((p) => p.groupe_id === g.id));
    return {
      id: g.id,
      nom: g.nom,
      date_fin: finDe(g.id),
      heuresRealisees: total.heuresRealisees,
      masseHoraire: total.masseHoraire,
      pourcentage: total.pourcentage,
      seancesSansDuree: total.seancesSansDuree,
    };
  });

  groupesProgression.sort((a, b) => {
    if (!a.date_fin && !b.date_fin) return 0;
    if (!a.date_fin) return 1;
    if (!b.date_fin) return -1;
    return new Date(a.date_fin).getTime() - new Date(b.date_fin).getTime();
  });

  // ── Évolution : deux courbes en pourcentage de la masse horaire totale ──
  //
  // « Réalisé » cumule les heures des séances marquées faites, à la date où
  // elles l'ont été. « Prévisionnel » cumule les heures des séances à leur
  // date planifiée : c'est là qu'on devrait en être. L'écart entre les deux
  // est ce que le formateur vient lire.
  const masseTotale = groupesProgression.reduce(
    (t, g) => t + g.masseHoraire,
    0,
  );

  const heuresDe = (s: {
    duree_realisee: number | null;
    duree_prevue: number | null;
  }) => Number(s.duree_realisee ?? s.duree_prevue ?? 0);

  const jour = (d: string) => new Date(d).toLocaleDateString("fr-CA");

  const faitParJour = new Map<string, number>();
  const prevuParJour = new Map<string, number>();

  for (const s of seances) {
    const heures = heuresDe(s);
    if (heures <= 0) continue;

    if (s.statut === "fait") {
      const quand = s.updated_at ?? s.created_at;
      if (quand) {
        const j = jour(quand);
        faitParJour.set(j, (faitParJour.get(j) ?? 0) + heures);
      }
    }
    if (s.date) {
      prevuParJour.set(s.date, (prevuParJour.get(s.date) ?? 0) + heures);
    }
  }

  // La fenêtre s'arrête aujourd'hui. Le calendrier est généré pour l'année
  // entière — cent cinquante séances planifiées jusqu'en mai —, si bien que
  // les « trente dernières dates » tombaient toutes dans le futur : une
  // fenêtre où rien n'a encore été fait, donc une courbe plate à zéro sur un
  // axe qui parlait de l'an prochain.
  const aujourdhui = maintenant();
  const jours = [...new Set([...faitParJour.keys(), ...prevuParJour.keys()])]
    .filter((j) => j <= aujourdhui)
    .sort()
    .slice(-30);

  const pourcent = (heures: number) =>
    masseTotale > 0 ? Math.round((heures / masseTotale) * 1000) / 10 : 0;

  // Ce qui précède la fenêtre est déjà acquis : la courbe part du niveau
  // atteint, elle ne le redécouvre pas. Repartir de zéro effaçait les heures
  // faites avant les trente derniers jours — c'est-à-dire, en début d'année,
  // à peu près tout.
  const debut = jours[0];
  let cumulFait = 0;
  let cumulPrevu = 0;
  if (debut) {
    for (const [j, h] of faitParJour) if (j < debut) cumulFait += h;
    for (const [j, h] of prevuParJour) if (j < debut) cumulPrevu += h;
  }

  const points: EvolutionPoint[] = jours.map((date) => {
    cumulFait += faitParJour.get(date) ?? 0;
    cumulPrevu += prevuParJour.get(date) ?? 0;
    return {
      date,
      label: new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
      }),
      realise: pourcent(cumulFait),
      previsionnel: pourcent(cumulPrevu),
    };
  });

  const evolution: Evolution = {
    points,
    actuel: points.length > 0 ? points[points.length - 1]!.realise : 0,
    gain:
      points.length > 1
        ? Math.round((points[points.length - 1]!.realise - points[0]!.realise) * 10) /
          10
        : 0,
  };

  return { stats, groupes: groupesProgression, evolution };
}

/**
 * Compteur de la cloche : ce qui attend une action du formateur.
 *
 * Le panneau de notifications a son propre écran et son propre atome ; ce
 * compteur existe pour que le badge de la barre supérieure dise la vérité dès
 * maintenant plutôt que d'afficher un nombre décoratif.
 *
 * Trois sources, et non deux : aux contrôles en brouillon et aux questions de
 * stagiaires sans réponse s'ajoutent les commentaires d'annonce. C'étaient les
 * seuls messages de stagiaires que le compteur ignorait — les réactions
 * « j'aime » n'appellent pas de réponse, et un rendu de devoir se suit depuis
 * l'écran du devoir, pas depuis une notification.
 *
 * « Sans réponse » se lit ici comme « rien du formateur ne lui a succédé sur
 * ce fil ». La définition tient avant même que le formateur puisse répondre
 * depuis son écran : tant que c'est le cas, tout commentaire compte, ce qui
 * est exactement la vérité.
 */
export async function getCompteurNotifications(): Promise<number> {
  const supabase = await createClient();

  const [controlesRes, questionsRes, reponsesRes, commentairesRes, profilsRes] =
    await Promise.all([
      supabase
        .from("controles")
        .select("id", { count: "exact", head: true })
        .eq("statut", "brouillon"),
      supabase.from("questions_support").select("id"),
      supabase.from("reponses_question").select("question_id"),
      supabase
        .from("commentaires_annonce")
        .select("id, annonce_id, auteur_id, created_at")
        .order("created_at"),
      supabase.from("profils").select("id, role"),
    ]);

  if (controlesRes.error) throw new Error(controlesRes.error.message);
  if (questionsRes.error) throw new Error(questionsRes.error.message);
  if (reponsesRes.error) throw new Error(reponsesRes.error.message);
  if (commentairesRes.error) throw new Error(commentairesRes.error.message);
  if (profilsRes.error) throw new Error(profilsRes.error.message);

  const repondues = new Set(
    (reponsesRes.data ?? []).map((r) => r.question_id as string),
  );
  const sansReponse = (questionsRes.data ?? []).filter(
    (q) => !repondues.has(q.id as string),
  ).length;

  return (
    (controlesRes.count ?? 0) +
    sansReponse +
    commentairesEnAttente(commentairesRes.data ?? [], profilsRes.data ?? [])
  );
}

type CommentaireBrut = {
  annonce_id: string;
  auteur_id: string;
  created_at: string;
};

/**
 * Commentaires de stagiaires auxquels rien n'a succédé du formateur.
 *
 * On compare par fil et par date plutôt que de compter tout ce qui n'est pas
 * lu : un formateur qui a répondu une fois à la fin d'une discussion y a
 * répondu, même si trois commentaires l'ont précédé. Compter chaque message
 * ferait sonner le badge pour une conversation déjà close.
 */
function commentairesEnAttente(
  commentaires: CommentaireBrut[],
  profils: { id: string; role: string | null }[],
): number {
  const stagiaires = new Set(
    profils.filter((p) => p.role === "stagiaire").map((p) => p.id),
  );

  // Dernier mot du formateur sur chaque fil.
  const derniereReponse = new Map<string, string>();
  for (const c of commentaires) {
    if (stagiaires.has(c.auteur_id)) continue;
    const vue = derniereReponse.get(c.annonce_id);
    if (!vue || c.created_at > vue) {
      derniereReponse.set(c.annonce_id, c.created_at);
    }
  }

  return commentaires.filter((c) => {
    if (!stagiaires.has(c.auteur_id)) return false;
    const reponse = derniereReponse.get(c.annonce_id);
    return !reponse || c.created_at > reponse;
  }).length;
}
