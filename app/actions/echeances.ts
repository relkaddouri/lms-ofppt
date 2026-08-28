"use server";

import { createClient } from "@/lib/supabase/server";
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

  const [controlesRes, seancesRes] = await Promise.all([
    supabase
      .from("controles")
      .select(
        "id, titre, type, date_prevue, date_administration, groupe_id, module_id, groupes(nom), modules(nom)",
      ),
    // Toutes les séances datées : c'est en elles que se lit « la deuxième
    // séance suivante ».
    supabase
      .from("seances")
      .select("groupe_id, module_id, date")
      .not("date", "is", null)
      .order("date"),
  ]);

  if (controlesRes.error) throw new Error(controlesRes.error.message);
  if (seancesRes.error) throw new Error(seancesRes.error.message);

  const parCouple = new Map<string, string[]>();
  for (const s of seancesRes.data ?? []) {
    if (!s.date) continue;
    const cle = `${s.groupe_id}|${s.module_id}`;
    parCouple.set(cle, [...(parCouple.get(cle) ?? []), s.date]);
  }

  const aujourdhui = new Date().toISOString().slice(0, 10);

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
