"use server";

import { createClient } from "@/lib/supabase/server";
import { getProgressionTousGroupes } from "@/app/actions/progression";
import { cumule } from "@/lib/progression";
import { maintenant } from "@/lib/format";

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

  const [groupesRes, seancesRes, stagiairesRes, modulesRes, controlesRes] =
    await Promise.all([
      supabase.from("groupes").select("id, nom, date_fin"),
      supabase
        .from("seances")
        .select(
          "statut, date, duree_prevue, duree_realisee, updated_at, created_at",
        ),
      supabase.from("stagiaires").select("id", { count: "exact", head: true }),
      supabase.from("modules").select("id", { count: "exact", head: true }),
      supabase
        .from("controles")
        .select("id", { count: "exact", head: true })
        .eq("statut", "brouillon"),
    ]);

  if (groupesRes.error) throw new Error(groupesRes.error.message);
  if (seancesRes.error) throw new Error(seancesRes.error.message);
  if (stagiairesRes.error) throw new Error(stagiairesRes.error.message);
  if (modulesRes.error) throw new Error(modulesRes.error.message);
  if (controlesRes.error) throw new Error(controlesRes.error.message);

  const groupes = groupesRes.data;
  const seances = seancesRes.data;

  const today = maintenant();
  const stats: DashboardStats = {
    totalStagiaires: stagiairesRes.count ?? 0,
    groupesActifs: groupes.filter(
      (g) => !g.date_fin || g.date_fin >= today,
    ).length,
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
      date_fin: g.date_fin,
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

  const jours = [...new Set([...faitParJour.keys(), ...prevuParJour.keys()])]
    .sort()
    .slice(-30);

  const pourcent = (heures: number) =>
    masseTotale > 0 ? Math.round((heures / masseTotale) * 1000) / 10 : 0;

  let cumulFait = 0;
  let cumulPrevu = 0;
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
 * maintenant plutôt que d'afficher un nombre décoratif. Il agrège les deux
 * sources déjà présentes en base — contrôles en brouillon et questions de
 * stagiaires sans réponse.
 */
export async function getCompteurNotifications(): Promise<number> {
  const supabase = await createClient();

  const [controlesRes, questionsRes, reponsesRes] = await Promise.all([
    supabase
      .from("controles")
      .select("id", { count: "exact", head: true })
      .eq("statut", "brouillon"),
    supabase.from("questions_support").select("id"),
    supabase.from("reponses_question").select("question_id"),
  ]);

  if (controlesRes.error) throw new Error(controlesRes.error.message);
  if (questionsRes.error) throw new Error(questionsRes.error.message);
  if (reponsesRes.error) throw new Error(reponsesRes.error.message);

  const repondues = new Set(
    (reponsesRes.data ?? []).map((r) => r.question_id as string),
  );
  const sansReponse = (questionsRes.data ?? []).filter(
    (q) => !repondues.has(q.id as string),
  ).length;

  return (controlesRes.count ?? 0) + sansReponse;
}
