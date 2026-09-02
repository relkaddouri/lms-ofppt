"use server";

import { createClient } from "@/lib/supabase/server";

export type AbsenceDetail = {
  seanceId: string;
  date: string | null;
  moduleId: string;
  moduleNom: string;
  objectif: string | null;
  motif: string | null;
};

export type PresenceStagiaireModule = {
  stagiaireId: string;
  nom: string;
  prenom: string;
  moduleId: string;
  /** Séances effectivement pointées : seules celles-ci fondent le taux. */
  pointees: number;
  presences: number;
  absences: number;
  /** Taux sur les séances pointées, ou null si rien n'a encore été pointé. */
  taux: number | null;
  detailAbsences: AbsenceDetail[];
};

export type ModuleDuGroupe = { id: string; nom: string; code: string | null };

export type BilanPresences = {
  modules: ModuleDuGroupe[];
  lignes: PresenceStagiaireModule[];
  /** Séances faites dont l'appel n'a jamais été pointé, tous modules confondus. */
  seancesNonPointees: number;
};

/**
 * Taux de présence par stagiaire et par module.
 *
 * Le taux se calcule sur les séances réellement pointées, jamais sur toutes
 * les séances du module : un appel oublié ferait sinon chuter le taux d'un
 * stagiaire qui était là. Le nombre de séances non pointées est renvoyé à
 * part, pour que le formateur sache sur quelle base il lit ces chiffres.
 */
export async function getBilanPresences(
  groupeId: string,
): Promise<BilanPresences> {
  const supabase = await createClient();

  const [stagiairesRes, seancesRes, modulesRes] = await Promise.all([
    supabase
      .from("stagiaires")
      .select("id, nom, prenom")
      .eq("groupe_id", groupeId)
      .order("nom"),
    supabase
      .from("seances")
      .select(
        "id, date, module_id, statut, objectif_operationnel, seance_groupes!inner(groupe_id)",
      )
      .eq("seance_groupes.groupe_id", groupeId),
    supabase
      .from("groupe_modules")
      .select("module_id, modules(nom, competences(code_operationnel))")
      .eq("groupe_id", groupeId),
  ]);

  if (stagiairesRes.error) throw new Error(stagiairesRes.error.message);
  if (seancesRes.error) throw new Error(seancesRes.error.message);
  if (modulesRes.error) throw new Error(modulesRes.error.message);

  const stagiaires = stagiairesRes.data ?? [];
  const seances = (seancesRes.data ?? []) as unknown as {
    id: string;
    date: string | null;
    module_id: string;
    statut: string;
    objectif_operationnel: string | null;
  }[];

  const modules: ModuleDuGroupe[] = (modulesRes.data ?? []).map((m) => {
    const r = m as unknown as {
      module_id: string;
      modules: {
        nom: string;
        competences: { code_operationnel: string | null } | null;
      } | null;
    };
    return {
      id: r.module_id,
      nom: r.modules?.nom ?? "Module",
      code: r.modules?.competences?.code_operationnel ?? null,
    };
  });

  if (stagiaires.length === 0 || seances.length === 0) {
    return { modules, lignes: [], seancesNonPointees: 0 };
  }

  const { data: presences, error } = await supabase
    .from("presences")
    .select("seance_id, stagiaire_id, present, motif")
    .in(
      "seance_id",
      seances.map((s) => s.id),
    );
  if (error) throw new Error(error.message);

  const parSeance = new Map(seances.map((s) => [s.id, s]));
  const nomModule = new Map(modules.map((m) => [m.id, m.nom]));

  // Une séance compte comme pointée dès qu'au moins un appel y a été fait.
  const seancesPointees = new Set(
    (presences ?? [])
      .filter((p) => p.present !== null)
      .map((p) => p.seance_id),
  );
  const seancesNonPointees = seances.filter(
    (s) => s.statut === "fait" && !seancesPointees.has(s.id),
  ).length;

  const lignes = new Map<string, PresenceStagiaireModule>();
  const cle = (stagiaireId: string, moduleId: string) =>
    `${stagiaireId}:${moduleId}`;

  // Une ligne par couple stagiaire × module, même vide : un module sans aucun
  // appel doit se voir, sinon on croit qu'il n'existe pas.
  for (const s of stagiaires) {
    for (const m of modules) {
      lignes.set(cle(s.id, m.id), {
        stagiaireId: s.id,
        nom: s.nom,
        prenom: s.prenom,
        moduleId: m.id,
        pointees: 0,
        presences: 0,
        absences: 0,
        taux: null,
        detailAbsences: [],
      });
    }
  }

  for (const p of presences ?? []) {
    if (p.present === null) continue;
    const seance = parSeance.get(p.seance_id);
    if (!seance) continue;
    const ligne = lignes.get(cle(p.stagiaire_id, seance.module_id));
    if (!ligne) continue;

    ligne.pointees += 1;
    if (p.present) {
      ligne.presences += 1;
    } else {
      ligne.absences += 1;
      ligne.detailAbsences.push({
        seanceId: seance.id,
        date: seance.date,
        moduleId: seance.module_id,
        moduleNom: nomModule.get(seance.module_id) ?? "Module",
        objectif: seance.objectif_operationnel,
        motif: p.motif,
      });
    }
  }

  for (const ligne of lignes.values()) {
    ligne.taux =
      ligne.pointees > 0
        ? Math.round((ligne.presences / ligne.pointees) * 100)
        : null;
    ligne.detailAbsences.sort((a, b) =>
      (b.date ?? "").localeCompare(a.date ?? ""),
    );
  }

  return { modules, lignes: [...lignes.values()], seancesNonPointees };
}
