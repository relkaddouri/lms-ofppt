"use server";

import { createClient } from "@/lib/supabase/server";

export type SeanceAvecFiche = {
  seanceId: string;
  date: string | null;
  dureeMinutes: number | null;
  objectif: string | null;
  moduleNom: string;
  /** Le classeur peut couvrir plusieurs groupes : chaque fiche porte le sien. */
  groupeNom: string;
  filiere: string;
  annee: number | null;
  /** Contenu brut de la dernière version enregistrée, à interpréter par le client. */
  contenu: string;
};

export type GroupeClasseur = {
  id: string;
  nom: string;
  filiere: string;
  annee: number | null;
  modules: { id: string; nom: string; code: string | null }[];
};

/**
 * Tous les groupes du formateur, chacun avec ses modules.
 *
 * Le classeur pédagogique est un document annuel du formateur, pas d'un
 * groupe : il le remet pour l'ensemble de sa charge. Il lui faut donc la liste
 * complète, avec de quoi restreindre à un groupe ou à un module s'il le veut.
 */
export async function getGroupesClasseur(): Promise<GroupeClasseur[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("groupes")
    .select(
      "id, nom, annee, specialites(nom), groupe_modules(module_id, modules(nom, competences(code_operationnel)))",
    )
    .order("nom");
  if (error) throw new Error(error.message);

  return (data ?? []).map((g) => {
    const r = g as unknown as {
      id: string;
      nom: string;
      annee: number | null;
      specialites: { nom: string } | null;
      groupe_modules: {
        module_id: string;
        modules: {
          nom: string;
          competences: { code_operationnel: string | null } | null;
        } | null;
      }[];
    };
    return {
      id: r.id,
      nom: r.nom,
      filiere: r.specialites?.nom ?? "Digital Design",
      annee: r.annee,
      // Un module que la RLS ne laisse pas lire ressortirait sous le nom
      // générique « Module » : autant ne pas le proposer du tout.
      modules: (r.groupe_modules ?? [])
        .filter((m) => m.modules !== null)
        .map((m) => ({
          id: m.module_id,
          nom: m.modules!.nom,
          code: m.modules!.competences?.code_operationnel ?? null,
        })),
    };
  });
}

/**
 * Séances datées d'une période qui possèdent une fiche enregistrée.
 *
 * Une séance sans fiche est écartée en silence : le classeur réunit ce qui a
 * été préparé, il n'invente pas de pages vides. Le compte des séances sans
 * fiche est renvoyé à part pour que le formateur sache ce qui manque.
 */
export async function getFichesPeriode(
  groupeId: string | null,
  moduleId: string | null,
  debut: string,
  fin: string,
): Promise<{ fiches: SeanceAvecFiche[]; sansFiche: number }> {
  const supabase = await createClient();

  let requete = supabase
    .from("seances")
    .select(
      "id, date, duree_prevue, objectif_operationnel, modules(nom), groupes(nom, annee, specialites(nom))",
    )
    .not("date", "is", null)
    .gte("date", debut)
    .lte("date", fin)
    .order("date");

  // Sans groupe, la RLS borne déjà la requête aux séances du formateur.
  if (groupeId) requete = requete.eq("groupe_id", groupeId);
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
      groupes: {
        nom: string;
        annee: number | null;
        specialites: { nom: string } | null;
      } | null;
    };
    const contenu = derniere.get(r.id);
    if (!contenu) continue;
    retenues.push({
      seanceId: r.id,
      date: r.date,
      dureeMinutes: r.duree_prevue ? Math.round(Number(r.duree_prevue) * 60) : null,
      objectif: r.objectif_operationnel,
      moduleNom: r.modules?.nom ?? "Module",
      groupeNom: r.groupes?.nom ?? "Groupe",
      filiere: r.groupes?.specialites?.nom ?? "Digital Design",
      annee: r.groupes?.annee ?? null,
      contenu,
    });
  }

  return { fiches: retenues, sansFiche: seances.length - retenues.length };
}
