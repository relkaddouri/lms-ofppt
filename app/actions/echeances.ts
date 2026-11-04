"use server";

import { createClient, getUser } from "@/lib/supabase/server";
import { maintenant } from "@/lib/format";
import { getPortee } from "@/app/actions/annees";
import {
  echeancesDe,
  trierEcheances,
  TYPES_ECHEANCE,
  type Echeance,
  type TypeEcheance,
} from "@/lib/echeances";

/**
 * Échéances réglementaires de tous les contrôles du formateur.
 *
 * Purement informatif : rien n'est envoyé, rien n'est bloqué. Ces délais
 * existent dans le règlement, l'application se contente de les rappeler. Le
 * formateur coche celles qu'il a accomplies : elles cessent alors d'alerter.
 */
export async function getEcheances(): Promise<Echeance[]> {
  const supabase = await createClient();

  // PRD §4.15 : les échéances réglementaires d'une année passée sont éteintes,
  // elles n'ont pas à alerter sur l'année en cours.
  const { groupeIds } = await getPortee();

  const [controlesRes, seancesRes, faitesRes] = await Promise.all([
    supabase
      .from("controles")
      .select(
        "id, titre, type, date_prevue, date_administration, groupe_id, module_id, groupes(nom), modules(nom)",
      )
      .in("groupe_id", groupeIds)
      // Un contrôle de test n'a pas d'échéance réglementaire (PRD §4.7bis).
      .neq("type", "TEST"),
    // Toutes les séances datées de l'année : c'est en elles que se lit « la
    // deuxième séance suivante ».
    supabase
      .from("seances")
      .select("module_id, date, seance_groupes!inner(groupe_id)")
      .in("seance_groupes.groupe_id", groupeIds)
      .not("date", "is", null)
      .order("date"),
    // La RLS ne rend que les contrôles du formateur connecté ; ceux d'une
    // autre année ne trouveront simplement pas leur échéance plus bas.
    supabase
      .from("echeances_faites")
      .select("controle_id, type_echeance, fait_le")
      .limit(5000),
  ]);

  if (controlesRes.error) throw new Error(controlesRes.error.message);
  if (seancesRes.error) throw new Error(seancesRes.error.message);
  // Tant que la migration 117 n'est pas passée, la table manque : les
  // échéances restent lisibles, simplement aucune n'est cochée.
  const faites = new Map(
    (faitesRes.error ? [] : (faitesRes.data ?? [])).map((f) => [
      `${f.controle_id}|${f.type_echeance}`,
      f.fait_le,
    ]),
  );

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
    ).map((e) =>
      e.type && faites.has(`${e.controleId}|${e.type}`)
        ? {
            ...e,
            faite: true,
            faiteLe: faites.get(`${e.controleId}|${e.type}`) ?? null,
          }
        : e,
    );
  });

  return trierEcheances(toutes);
}

/**
 * Coche ou décoche une échéance.
 *
 * Pas de `revalidatePath` : la case se met à jour sur place, et recharger tout
 * l'emploi du temps pour une case coûterait plus que la case elle-même.
 */
export async function marquerEcheance(
  controleId: string,
  type: TypeEcheance,
  faite: boolean,
): Promise<void> {
  if (!TYPES_ECHEANCE.includes(type)) {
    throw new Error("Échéance inconnue.");
  }
  const user = await getUser();
  if (!user) throw new Error("Session expirée : reconnectez-vous.");

  const supabase = await createClient();
  const { error } = faite
    ? await supabase
        .from("echeances_faites")
        .upsert(
          { controle_id: controleId, type_echeance: type, fait_par: user.id },
          { onConflict: "controle_id,type_echeance", ignoreDuplicates: true },
        )
    : await supabase
        .from("echeances_faites")
        .delete()
        .eq("controle_id", controleId)
        .eq("type_echeance", type);

  if (error) {
    throw new Error(
      error.code === "42P01" || error.code === "PGRST205"
        ? "La table des échéances n'existe pas encore : appliquez la migration 117 dans Supabase."
        : error.message,
    );
  }
}
