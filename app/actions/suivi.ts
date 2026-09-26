"use server";

import { createClient } from "@/lib/supabase/server";
import { libelleModule } from "@/lib/modules";
import { baremeAttendu, type TypeControleBareme } from "@/lib/controles";
import type { LectureSuivi } from "@/lib/lecture-suivi";

/**
 * Le suivi d'un stagiaire (demande du 25/09/2026).
 *
 * Ce que le formateur cherche tient en trois questions : travaille-t-il, sur
 * quoi, et qu'est-ce qui ne rentre pas. L'écran y répond avec ce que
 * l'application sait déjà — chapitres lus, tentatives de quiz, devoirs
 * remis, copies rendues — sans rien mesurer de plus.
 *
 * Le temps passé se déduit des actions et non d'un mouchard : on compte les
 * jours où il a fait quelque chose, et le temps réellement passé sur les
 * quiz, qui est la seule durée que l'application observe honnêtement. Un
 * chronomètre d'onglet ouvert dirait « trois heures » d'un cours laissé
 * affiché pendant le déjeuner.
 */

export type ModuleSuivi = {
  id: string;
  libelle: string;
  chapitres: number;
  lus: number;
  progression: number;
  /** Tentatives de quiz de chapitre sur ce module, et leur moyenne en %. */
  tentatives: number;
  reussite: number | null;
  bilans: number;
};

export type NotionRatee = {
  question: string;
  erreurs: number;
  tentatives: number;
};

export type ControleSuivi = {
  id: string;
  titre: string;
  type: string;
  note: number | null;
  total: number;
  date: string | null;
  publie: boolean;
};

export type SuiviStagiaire = {
  identite: {
    id: string;
    nom: string;
    prenom: string;
    photo: string | null;
    cef: string | null;
    groupeId: string;
    groupeNom: string | null;
    aUnCompte: boolean;
  };
  activite: {
    joursActifs: number;
    premiere: string | null;
    derniere: string | null;
    actions: number;
    /** Temps passé sur les quiz, la seule durée réellement observée. */
    secondesQuiz: number;
    /** Les trente derniers jours, un point par jour : 0 ou le nombre d'actions. */
    calendrier: { jour: string; actions: number }[];
  };
  modules: ModuleSuivi[];
  quiz: {
    tentatives: number;
    reussite: number | null;
    /** Chapitres distincts sur lesquels il s'est testé. */
    chapitres: number;
    bilans: number;
    /** Les dix dernières tentatives, de la plus récente à la plus ancienne. */
    dernieres: {
      quand: string;
      genre: "chapitre" | "bilan";
      cible: string;
      justes: number;
      questions: number;
    }[];
  };
  notions: NotionRatee[];
  controles: ControleSuivi[];
  devoirs: { remis: number; total: number };
};

type LigneSupport = {
  id: string;
  seance_id: string;
  contenu: unknown;
  version: number;
  seances: {
    module_id: string;
    modules: {
      nom: string;
      competences: { code_operationnel: string | null } | null;
    } | null;
    suggestions_pedagogiques: { apprentissage_base: string | null } | null;
  } | null;
};

type LigneTentative = {
  genre: "chapitre" | "bilan";
  support_id: string | null;
  module_id: string | null;
  rang: number | null;
  justes: number;
  questions: number;
  secondes: number | null;
  created_at: string;
  reponses: { question: string; juste: boolean }[];
};

const jour = (instant: string) => instant.slice(0, 10);

const pourcentage = (part: number, total: number) =>
  total > 0 ? Math.round((part / total) * 100) : 0;

/** Le titre écrit dans le support, à défaut le nom de son apprentissage. */
function titreDu(l: LigneSupport): string {
  const t = (l.contenu as { titre?: unknown } | null)?.titre;
  if (typeof t === "string" && t.trim()) return t.trim();
  return l.seances?.suggestions_pedagogiques?.apprentissage_base?.trim() || "Chapitre";
}

export async function getSuiviStagiaire(
  stagiaireId: string,
): Promise<SuiviStagiaire | null> {
  const supabase = await createClient();

  const { data: s, error } = await supabase
    .from("stagiaires")
    .select("id, nom, prenom, photo, cef, user_id, groupe_id, groupes(nom)")
    .eq("id", stagiaireId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!s?.groupe_id) return null;

  const [supportsRes, lusRes, tentativesRes, devoirsRes, copiesRes] =
    await Promise.all([
      supabase
        .from("supports_seance")
        .select(
          "id, seance_id, contenu, version, seances!inner(module_id, modules(nom, competences(code_operationnel)), suggestions_pedagogiques(apprentissage_base), seance_groupes!inner(groupe_id))",
        )
        .eq("destinataire", "stagiaire")
        .eq("seances.seance_groupes.groupe_id", s.groupe_id)
        .order("version", { ascending: false }),
      supabase
        .from("progression_chapitre")
        .select("support_id, lu_le")
        .eq("stagiaire_id", stagiaireId),
      supabase
        .from("tentatives_quiz")
        .select(
          "genre, support_id, module_id, rang, justes, questions, secondes, created_at, reponses",
        )
        .eq("stagiaire_id", stagiaireId)
        .order("created_at", { ascending: false }),
      supabase
        .from("devoirs_rendus")
        .select("statut, date_rendu")
        .eq("stagiaire_id", stagiaireId),
      supabase
        .from("passations_controle")
        .select(
          "id, note, publie_le, submitted_at, controles(id, titre, type, bareme_total, date_prevue)",
        )
        .eq("stagiaire_id", stagiaireId),
    ]);

  // Une séance, un chapitre : la version la plus haute fait foi.
  const parSeance = new Map<string, LigneSupport>();
  for (const l of (supportsRes.data ?? []) as unknown as LigneSupport[]) {
    if (!parSeance.has(l.seance_id)) parSeance.set(l.seance_id, l);
  }
  const supports = [...parSeance.values()];
  const moduleDuSupport = new Map<string, string>();
  const titreDuSupport = new Map<string, string>();
  for (const l of supports) {
    if (l.seances?.module_id) moduleDuSupport.set(l.id, l.seances.module_id);
    titreDuSupport.set(l.id, titreDu(l));
  }

  const lus = new Set((lusRes.data ?? []).map((l) => l.support_id));
  const tentatives = (tentativesRes.data ?? []) as unknown as LigneTentative[];

  // ── Les modules ──────────────────────────────────────────────────────
  const modules = new Map<string, ModuleSuivi & { justes: number; sur: number }>();
  for (const l of supports) {
    const m = l.seances;
    if (!m?.module_id) continue;
    const vu = modules.get(m.module_id);
    if (vu) {
      vu.chapitres += 1;
      if (lus.has(l.id)) vu.lus += 1;
      continue;
    }
    const code = m.modules?.competences?.code_operationnel ?? null;
    modules.set(m.module_id, {
      id: m.module_id,
      libelle: libelleModule(code, m.modules?.nom ?? "Module"),
      chapitres: 1,
      lus: lus.has(l.id) ? 1 : 0,
      progression: 0,
      tentatives: 0,
      reussite: null,
      bilans: 0,
      justes: 0,
      sur: 0,
    });
  }

  for (const t of tentatives) {
    const moduleId =
      t.genre === "bilan"
        ? t.module_id
        : t.support_id
          ? (moduleDuSupport.get(t.support_id) ?? null)
          : null;
    if (!moduleId) continue;
    const m = modules.get(moduleId);
    if (!m) continue;
    if (t.genre === "bilan") m.bilans += 1;
    else m.tentatives += 1;
    m.justes += t.justes;
    m.sur += t.questions;
  }

  // ── L'activité ───────────────────────────────────────────────────────
  const traces: string[] = [
    ...(lusRes.data ?? []).map((l) => l.lu_le),
    ...tentatives.map((t) => t.created_at),
    ...(devoirsRes.data ?? [])
      .map((d) => d.date_rendu)
      .filter((d): d is string => !!d),
    ...(copiesRes.data ?? [])
      .map((c) => c.submitted_at)
      .filter((d): d is string => !!d),
  ];
  const jours = new Map<string, number>();
  for (const t of traces) jours.set(jour(t), (jours.get(jour(t)) ?? 0) + 1);
  const triees = [...traces].sort();

  // Trente jours glissants : c'est la fenêtre où un formateur reconnaît une
  // habitude — ou son absence.
  const calendrier: { jour: string; actions: number }[] = [];
  const aujourdhui = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(aujourdhui);
    d.setUTCDate(d.getUTCDate() - i);
    const cle = d.toISOString().slice(0, 10);
    calendrier.push({ jour: cle, actions: jours.get(cle) ?? 0 });
  }

  // ── Les notions qui résistent ────────────────────────────────────────
  const notions = new Map<string, NotionRatee>();
  for (const t of tentatives) {
    for (const r of t.reponses ?? []) {
      const cle = r.question?.trim();
      if (!cle) continue;
      const vu = notions.get(cle) ?? { question: cle, erreurs: 0, tentatives: 0 };
      vu.tentatives += 1;
      if (!r.juste) vu.erreurs += 1;
      notions.set(cle, vu);
    }
  }

  const justesTotal = tentatives.reduce((n, t) => n + t.justes, 0);
  const questionsTotal = tentatives.reduce((n, t) => n + t.questions, 0);

  return {
    identite: {
      id: s.id,
      nom: s.nom,
      prenom: s.prenom,
      photo: s.photo,
      cef: s.cef,
      groupeId: s.groupe_id,
      groupeNom: (s.groupes as { nom: string } | null)?.nom ?? null,
      aUnCompte: !!s.user_id,
    },
    activite: {
      joursActifs: jours.size,
      premiere: triees[0] ?? null,
      derniere: triees.at(-1) ?? null,
      actions: traces.length,
      secondesQuiz: tentatives.reduce((n, t) => n + (t.secondes ?? 0), 0),
      calendrier,
    },
    modules: [...modules.values()]
      .map(({ justes, sur, ...m }) => ({
        ...m,
        progression: pourcentage(m.lus, m.chapitres),
        reussite: sur > 0 ? pourcentage(justes, sur) : null,
      }))
      .sort((a, b) => b.progression - a.progression),
    quiz: {
      tentatives: tentatives.filter((t) => t.genre === "chapitre").length,
      reussite: questionsTotal > 0 ? pourcentage(justesTotal, questionsTotal) : null,
      chapitres: new Set(
        tentatives
          .filter((t) => t.genre === "chapitre" && t.support_id)
          .map((t) => t.support_id),
      ).size,
      bilans: tentatives.filter((t) => t.genre === "bilan").length,
      dernieres: tentatives.slice(0, 10).map((t) => ({
        quand: t.created_at,
        genre: t.genre,
        cible:
          t.genre === "bilan"
            ? `Bilan ${t.rang ?? ""}`.trim()
            : (titreDuSupport.get(t.support_id ?? "") ?? "Chapitre"),
        justes: t.justes,
        questions: t.questions,
      })),
    },
    // Ce qui a été raté au moins une fois, le plus souvent raté d'abord. Une
    // notion réussie du premier coup n'apprend rien au formateur.
    notions: [...notions.values()]
      .filter((n) => n.erreurs > 0)
      .sort((a, b) => b.erreurs - a.erreurs || b.tentatives - a.tentatives)
      .slice(0, 8),
    controles: (copiesRes.data ?? [])
      .map((c) => {
        const ctrl = c.controles as {
          id: string;
          titre: string | null;
          type: string;
          bareme_total: number | null;
          date_prevue: string | null;
        } | null;
        return {
          id: ctrl?.id ?? c.id,
          titre: ctrl?.titre ?? "Contrôle",
          type: ctrl?.type ?? "CC",
          note: c.publie_le && c.note !== null ? Number(c.note) : null,
          total: baremeAttendu(
            (ctrl?.type ?? "CC") as TypeControleBareme,
            ctrl?.bareme_total,
          ),
          date: ctrl?.date_prevue ?? c.submitted_at?.slice(0, 10) ?? null,
          publie: !!c.publie_le,
        };
      })
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")),
    devoirs: {
      remis: (devoirsRes.data ?? []).filter((d) => d.statut === "rendu").length,
      total: (devoirsRes.data ?? []).length,
    },
  };
}

/**
 * La lecture déjà écrite pour ce stagiaire, s'il y en a une (atome 13.3).
 *
 * Lue au rendu de la page : la fiche s'ouvre avec la dernière lecture, sans
 * appeler le modèle. C'est le bouton qui en demande une nouvelle.
 */
export async function getLectureSuivi(stagiaireId: string): Promise<{
  lecture: LectureSuivi;
  assise: string | null;
  modele: string | null;
  genereLe: string;
} | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lectures_suivi")
    .select("contenu, assise, modele, genere_le")
    .eq("stagiaire_id", stagiaireId)
    .maybeSingle();
  if (!data) return null;
  return {
    lecture: data.contenu as unknown as LectureSuivi,
    assise: data.assise,
    modele: data.modele,
    genereLe: data.genere_le,
  };
}
