"use server";

import { createClient } from "@/lib/supabase/server";
import { maintenant } from "@/lib/format";
import { getPortee } from "@/app/actions/annees";
import {
  echeancesDe,
  trierEcheances,
  type Echeance,
} from "@/lib/echeances";

/**
 * Échéances réglementaires de tous les contrôles du formateur.
 *
 * Purement informatif : rien n'est envoyé, rien n'est bloqué. Ces délais
 * existent dans le règlement, l'application se contente de les rappeler.
 */
export async function getEcheances(): Promise<Echeance[]> {
  const supabase = await createClient();

  // PRD §4.15 : les échéances réglementaires d'une année passée sont éteintes,
  // elles n'ont pas à alerter sur l'année en cours.
  const { groupeIds } = await getPortee();

  const [controlesRes, seancesRes] = await Promise.all([
    supabase
      .from("controles")
      .select(
        "id, titre, type, date_prevue, date_administration, groupe_id, module_id, groupes(nom), modules(nom)",
      )
      .in("groupe_id", groupeIds),
    // Toutes les séances datées de l'année : c'est en elles que se lit « la
    // deuxième séance suivante ».
    supabase
      .from("seances")
      .select("module_id, date, seance_groupes!inner(groupe_id)")
      .in("seance_groupes.groupe_id", groupeIds)
      .not("date", "is", null)
      .order("date"),
  ]);

  if (controlesRes.error) throw new Error(controlesRes.error.message);
  if (seancesRes.error) throw new Error(seancesRes.error.message);

  const parCouple = new Map<string, string[]>();
  for (const s of seancesRes.data ?? []) {
    if (!s.date) continue;
    // Une séance FAD partagée compte pour chacun de ses groupes : chacun a
    // bien reçu ces heures, même si le formateur ne les a dispensées qu'une
    // fois.
    for (const lien of s.seance_groupes ?? []) {
      const cle = `${lien.groupe_id}|${s.module_id}`;
      parCouple.set(cle, [...(parCouple.get(cle) ?? []), s.date]);
    }
  }

  const aujourdhui = maintenant();

  const controles = (controlesRes.data ?? []) as unknown as {
    id: string;
    titre: string | null;
    type: "CC" | "EFM";
    date_prevue: string | null;
    date_administration: string | null;
    groupe_id: string;
    module_id: string;
    groupes: { nom: string } | null;
    modules: { nom: string } | null;
  }[];

  const toutes = controles.flatMap((c) => {
    const date = c.date_administration ?? c.date_prevue;
    // Un contrôle sans date n'a pas d'échéance à rappeler : il a d'abord
    // besoin d'être daté, ce que le calendrier signale déjà.
    if (!date) return [];

    const suivantes = (parCouple.get(`${c.groupe_id}|${c.module_id}`) ?? [])
      .filter((d) => d > date)
      .sort();

    return echeancesDe(
      {
        id: c.id,
        libelle: c.titre ?? c.modules?.nom ?? "Contrôle",
        groupeNom: c.groupes?.nom ?? "—",
        type: c.type,
        date,
      },
      suivantes,
      aujourdhui,
    );
  });

  return trierEcheances(toutes);
}
