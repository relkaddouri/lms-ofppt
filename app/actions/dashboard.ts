"use server";

import { createClient } from "@/lib/supabase/server";
import { getProgressionTousGroupes } from "@/app/actions/progression";
import { cumule } from "@/lib/progression";

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
  totalFait: number;
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
  evolution: EvolutionPoint[];
}> {
  const supabase = await createClient();

  const [groupesRes, seancesRes, stagiairesRes, modulesRes, controlesRes] =
    await Promise.all([
      supabase.from("groupes").select("id, nom, date_fin"),
      supabase.from("seances").select("groupe_id, statut, updated_at, created_at"),
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

  const today = new Date().toISOString().slice(0, 10);
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

  const faitSeances = seances
    .filter((s) => s.statut === "fait")
    .map((s) => s.updated_at ?? s.created_at)
    .filter((d): d is string => Boolean(d))
    .sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime(),
    );

  const dayMap = new Map<string, number>();
  for (const d of faitSeances) {
    const day = new Date(d).toLocaleDateString("fr-CA");
    dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
  }

  let cumul = 0;
  const evolution: EvolutionPoint[] = [...dayMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => {
      cumul += count;
      return {
        date,
        label: new Date(date).toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "2-digit",
        }),
        totalFait: cumul,
      };
    });

  return { stats, groupes: groupesProgression, evolution };
}
