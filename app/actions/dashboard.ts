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
      // Les heures se placent à la date de la séance, non au jour où elle a
      // été cochée. Le prévisionnel est déjà à la date planifiée : garder le
      // réalisé au jour de saisie revenait à comparer deux échelles — le
      // calendrier de formation d'un côté, les habitudes de saisie de l'autre
      // — et l'écart entre les deux courbes, seule chose que ce graphe existe
      // pour montrer, ne voulait alors rien dire. Une séance pointée le
      // lendemain faisait un pic là où il n'y avait qu'un jour de retard
      // administratif.
      //
      // Le prix en est assumé : la courbe se corrige rétroactivement quand une
      // séance ancienne est cochée. C'est ce qu'on veut d'un indicateur
      // d'avancement — la vérité corrigée plutôt que la trace de la saisie.
      //
      // Sans date, le jour du pointage sert de repli : une séance faite doit
      // compter quelque part.
      const quand = s.date ?? s.updated_at ?? s.created_at;
      if (quand) {
        const j = s.date ?? jour(quand);
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
        ? Math.round(
            (points[points.length - 1]!.realise - points[0]!.realise) * 10,
          ) / 10
        : 0,
  };

  return { stats, groupes: groupesProgression, evolution };
}
