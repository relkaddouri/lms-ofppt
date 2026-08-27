"use server";

import { createClient } from "@/lib/supabase/server";
import { calculerRappel, type Rappel } from "@/lib/rappels";

export type RappelCouple = {
  groupe_id: string;
  groupeNom: string;
  module_id: string;
  moduleNom: string;
  codeOperationnel: string | null;
  masseHoraire: number;
  heuresFaites: number;
  rappel: Rappel;
};

/**
 * Rappels de contrôle pour les couples groupe + module du formateur.
 *
 * Purement informatif : rien n'est généré ni programmé ici. Le formateur voit
 * qu'une échéance est atteinte et décide.
 */
export async function getRappelsControle(
  groupeId?: string,
): Promise<RappelCouple[]> {
  const supabase = await createClient();

  let couples = supabase
    .from("groupe_modules")
    .select(
      "groupe_id, module_id, masse_horaire_allouee, groupes(nom), modules(nom, competences(code_operationnel))",
    );
  if (groupeId) couples = couples.eq("groupe_id", groupeId);

  const { data: lignes, error } = await couples;
  if (error) throw new Error(error.message);
  if (!lignes || lignes.length === 0) return [];

  const groupeIds = [...new Set(lignes.map((l) => l.groupe_id))];

  // Heures faites et contrôles déjà posés, en deux requêtes groupées plutôt
  // qu'une paire par couple (conventions.md L.53).
  const [seancesRes, controlesRes] = await Promise.all([
    supabase
      .from("seances")
      .select("groupe_id, module_id, duree_realisee, duree_prevue")
      .in("groupe_id", groupeIds)
      .eq("statut", "fait"),
    supabase
      .from("controles")
      .select("groupe_id, module_id, statut")
      .in("groupe_id", groupeIds),
  ]);

  if (seancesRes.error) throw new Error(seancesRes.error.message);
  if (controlesRes.error) throw new Error(controlesRes.error.message);

  const cle = (g: string, m: string) => `${g}|${m}`;

  const heures = new Map<string, number>();
  for (const s of seancesRes.data ?? []) {
    const k = cle(s.groupe_id, s.module_id);
    heures.set(
      k,
      (heures.get(k) ?? 0) + Number(s.duree_realisee ?? s.duree_prevue ?? 0),
    );
  }

  // Un brouillon ne couvre pas une échéance : il n'a pas été administré.
  const couverts = new Map<string, number>();
  for (const c of controlesRes.data ?? []) {
    if (c.statut === "brouillon") continue;
    const k = cle(c.groupe_id, c.module_id);
    couverts.set(k, (couverts.get(k) ?? 0) + 1);
  }

  return (
    lignes as unknown as {
      groupe_id: string;
      module_id: string;
      masse_horaire_allouee: number;
      groupes: { nom: string } | null;
      modules: {
        nom: string;
        competences: { code_operationnel: string | null } | null;
      } | null;
    }[]
  ).map((l) => {
    const k = cle(l.groupe_id, l.module_id);
    const masse = Number(l.masse_horaire_allouee) || 0;
    const faites = heures.get(k) ?? 0;
    return {
      groupe_id: l.groupe_id,
      groupeNom: l.groupes?.nom ?? "—",
      module_id: l.module_id,
      moduleNom: l.modules?.nom ?? "—",
      codeOperationnel: l.modules?.competences?.code_operationnel ?? null,
      masseHoraire: masse,
      heuresFaites: faites,
      rappel: calculerRappel(masse, faites, couverts.get(k) ?? 0),
    };
  });
}
