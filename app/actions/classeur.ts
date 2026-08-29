"use server";

import { createClient } from "@/lib/supabase/server";

export type SeanceAvecFiche = {
  seanceId: string;
  date: string | null;
  dureeMinutes: number | null;
  objectif: string | null;
  moduleNom: string;
  /** Contenu brut de la dernière version enregistrée, à interpréter par le client. */
  contenu: string;
};

export type ContexteClasseur = {
  groupeNom: string;
  filiere: string;
  annee: number | null;
  modules: { id: string; nom: string; code: string | null }[];
};

export async function getContexteClasseur(
  groupeId: string,
): Promise<ContexteClasseur | null> {
  const supabase = await createClient();

  const [groupeRes, modulesRes] = await Promise.all([
    supabase
      .from("groupes")
      .select("nom, annee, specialites(nom)")
      .eq("id", groupeId)
      .maybeSingle(),
    supabase
      .from("groupe_modules")
      .select("module_id, modules(nom, competences(code_operationnel))")
      .eq("groupe_id", groupeId),
  ]);

  if (groupeRes.error) throw new Error(groupeRes.error.message);
  if (modulesRes.error) throw new Error(modulesRes.error.message);
  if (!groupeRes.data) return null;

  const g = groupeRes.data as unknown as {
    nom: string;
    annee: number | null;
    specialites: { nom: string } | null;
  };

  return {
    groupeNom: g.nom,
    filiere: g.specialites?.nom ?? "Digital Design",
    annee: g.annee,
    modules: (modulesRes.data ?? []).map((m) => {
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
    }),
  };
}

/**
 * Séances datées d'une période qui possèdent une fiche enregistrée.
 *
 * Une séance sans fiche est écartée en silence : le classeur réunit ce qui a
 * été préparé, il n'invente pas de pages vides. Le compte des séances sans
 * fiche est renvoyé à part pour que le formateur sache ce qui manque.
 */
export async function getFichesPeriode(
  groupeId: string,
  moduleId: string | null,
  debut: string,
  fin: string,
): Promise<{ fiches: SeanceAvecFiche[]; sansFiche: number }> {
  const supabase = await createClient();

  let requete = supabase
    .from("seances")
    .select("id, date, duree_prevue, objectif_operationnel, modules(nom)")
    .eq("groupe_id", groupeId)
    .not("date", "is", null)
    .gte("date", debut)
    .lte("date", fin)
    .order("date");

  if (moduleId) requete = requete.eq("module_id", moduleId);

  const { data: seances, error } = await requete;
  if (error) throw new Error(error.message);
  if (!seances || seances.length === 0) return { fiches: [], sansFiche: 0 };

  const { data: fiches, error: erreurFiches } = await supabase
    .from("fiches_preparation")
    .select("seance_id, contenu, version")
    .in(
      "seance_id",
      seances.map((s) => s.id),
    )
    .order("version", { ascending: false });
  if (erreurFiches) throw new Error(erreurFiches.message);

  // La version la plus haute fait foi : c'est celle que le formateur a relue
  // en dernier.
  const derniere = new Map<string, string>();
  for (const f of fiches ?? []) {
    if (!derniere.has(f.seance_id)) derniere.set(f.seance_id, f.contenu);
  }

  const retenues: SeanceAvecFiche[] = [];
  for (const s of seances) {
    const r = s as unknown as {
      id: string;
      date: string | null;
      duree_prevue: number | null;
      objectif_operationnel: string | null;
      modules: { nom: string } | null;
    };
    const contenu = derniere.get(r.id);
    if (!contenu) continue;
    retenues.push({
      seanceId: r.id,
      date: r.date,
      dureeMinutes: r.duree_prevue ? Math.round(Number(r.duree_prevue) * 60) : null,
      objectif: r.objectif_operationnel,
      moduleNom: r.modules?.nom ?? "Module",
      contenu,
    });
  }

  return { fiches: retenues, sansFiche: seances.length - retenues.length };
}
