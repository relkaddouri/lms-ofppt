"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type SeanceCalendrier = {
  id: string;
  groupe_id: string;
  groupeNom: string;
  moduleNom: string;
  codeOperationnel: string | null;
  date: string;
  heure_debut: string | null;
  heure_fin: string | null;
  statut: string;
  nature: "theorique" | "pratique" | null;
  objectif: string | null;
};

export type ControleCalendrier = {
  id: string;
  module_id: string;
  groupeNom: string;
  moduleNom: string;
  titre: string | null;
  type: "CC" | "EFM";
  type_efm: "local" | "regional" | null;
  date_prevue: string | null;
  date_administration: string | null;
  date_envoi_propositions: string | null;
  /** Une date arrêtée fait foi ; une date seulement prévue reste une estimation. */
  confirmee: boolean;
};

export type APlanifier = {
  groupe_id: string;
  groupeNom: string;
  module_id: string;
  moduleNom: string;
  codeOperationnel: string | null;
  seances: number;
  heures: number;
};

export type Calendrier = {
  seances: SeanceCalendrier[];
  controles: ControleCalendrier[];
  /** Séances sans date, regroupées par couple : le travail qui reste à poser. */
  aPlanifier: APlanifier[];
  seancesSansDate: number;
};

export async function getCalendrier(
  debut: string,
  fin: string,
): Promise<Calendrier> {
  const supabase = await createClient();

  const [seancesRes, controlesRes, sansDateRes] = await Promise.all([
    supabase
      .from("seances")
      .select(
        "id, date, heure_debut, heure_fin, statut, nature, est_fad, objectif_operationnel, seance_groupes(groupe_id, groupes(nom)), modules(nom, competences(code_operationnel))",
      )
      .not("date", "is", null)
      .gte("date", debut)
      .lte("date", fin)
      .order("date")
      .order("heure_debut", { nullsFirst: false }),
    // Les contrôles sont peu nombreux : on les prend tous, pour pouvoir
    // signaler ceux qui n'ont pas encore de date.
    supabase
      .from("controles")
      .select(
        "id, module_id, titre, type, type_efm, date_prevue, date_administration, date_envoi_propositions, groupes(nom), modules(nom)",
      )
      .order("date_prevue", { nullsFirst: false }),
    // Ce qui reste à poser dans le calendrier : sans ce compte, une grille
    // vide laisse croire qu'il n'y a rien à faire.
    supabase
      .from("seances")
      .select(
        "module_id, duree_prevue, duree_realisee, seance_groupes(groupe_id, groupes(nom)), modules(nom, competences(code_operationnel))",
      )
      .is("date", null),
  ]);

  if (seancesRes.error) throw new Error(seancesRes.error.message);
  if (controlesRes.error) throw new Error(controlesRes.error.message);
  if (sansDateRes.error) throw new Error(sansDateRes.error.message);

  const groupes = new Map<string, APlanifier>();
  for (const s of (sansDateRes.data ?? []) as unknown as {
    module_id: string;
    duree_prevue: number | null;
    duree_realisee: number | null;
    seance_groupes: { groupe_id: string; groupes: { nom: string } | null }[];
    modules: {
      nom: string;
      competences: { code_operationnel: string | null } | null;
    } | null;
  }[]) {
    // Une séance FAD partagée reste à poser pour chacun de ses groupes.
    for (const lien of s.seance_groupes ?? []) {
      const cle = `${lien.groupe_id}|${s.module_id}`;
      const courant = groupes.get(cle) ?? {
        groupe_id: lien.groupe_id,
        groupeNom: lien.groupes?.nom ?? "—",
        module_id: s.module_id,
        moduleNom: s.modules?.nom ?? "—",
        codeOperationnel: s.modules?.competences?.code_operationnel ?? null,
        seances: 0,
        heures: 0,
      };
      courant.seances += 1;
      courant.heures += Number(s.duree_prevue ?? s.duree_realisee ?? 0);
      groupes.set(cle, courant);
    }
  }

  const seances = (seancesRes.data ?? []) as unknown as (Omit<
    SeanceCalendrier,
    "groupeNom" | "moduleNom" | "codeOperationnel" | "objectif" | "groupe_id"
  > & {
    objectif_operationnel: string | null;
    seance_groupes: { groupe_id: string; groupes: { nom: string } | null }[];
    modules: {
      nom: string;
      competences: { code_operationnel: string | null } | null;
    } | null;
  })[];

  const controles = (controlesRes.data ?? []) as unknown as (Omit<
    ControleCalendrier,
    "groupeNom" | "moduleNom" | "confirmee"
  > & {
    groupes: { nom: string } | null;
    modules: { nom: string } | null;
  })[];

  return {
    aPlanifier: [...groupes.values()].sort((a, b) => b.seances - a.seances),
    seancesSansDate: (sansDateRes.data ?? []).length,
    // Une séance partagée apparaît dans la grille de chacun de ses groupes :
    // c'est bien le même créneau, vu depuis deux groupes.
    seances: seances.flatMap((s) =>
      (s.seance_groupes ?? []).map((lien) => ({
        id: s.id,
        groupe_id: lien.groupe_id,
        groupeNom: lien.groupes?.nom ?? "—",
        moduleNom: s.modules?.nom ?? "—",
        codeOperationnel: s.modules?.competences?.code_operationnel ?? null,
        date: s.date,
        heure_debut: s.heure_debut,
        heure_fin: s.heure_fin,
        statut: s.statut,
        nature: s.nature,
        objectif: s.objectif_operationnel,
      })),
    ),
    controles: controles.map((c) => ({
      id: c.id,
      module_id: c.module_id,
      groupeNom: c.groupes?.nom ?? "—",
      moduleNom: c.modules?.nom ?? "—",
      titre: c.titre,
      type: c.type,
      type_efm: c.type_efm,
      date_prevue: c.date_prevue,
      date_administration: c.date_administration,
      date_envoi_propositions: c.date_envoi_propositions,
      // Une EFM régionale est arrêtée par la région : sa date fait foi dès
      // qu'elle est saisie. Le reste n'est qu'une estimation du formateur, tant
      // que le contrôle n'a pas été administré.
      confirmee:
        c.date_administration !== null ||
        (c.type === "EFM" && c.type_efm === "regional" && c.date_prevue !== null),
    })),
  };
}

export async function setDatesEfmRegional(
  controleId: string,
  dateEnvoiPropositions: string | null,
  dateEpreuve: string | null,
) {
  if (
    dateEnvoiPropositions &&
    dateEpreuve &&
    dateEnvoiPropositions > dateEpreuve
  ) {
    throw new Error(
      "Les propositions se transmettent avant l'épreuve, pas après.",
    );
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("controles")
    .update({
      date_envoi_propositions: dateEnvoiPropositions,
      date_prevue: dateEpreuve,
    })
    .eq("id", controleId);

  if (error) throw new Error(error.message);
  revalidatePath("/calendrier");
}
