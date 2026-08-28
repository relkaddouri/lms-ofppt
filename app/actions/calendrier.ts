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

export type Calendrier = {
  seances: SeanceCalendrier[];
  controles: ControleCalendrier[];
};

export async function getCalendrier(
  debut: string,
  fin: string,
): Promise<Calendrier> {
  const supabase = await createClient();

  const [seancesRes, controlesRes] = await Promise.all([
    supabase
      .from("seances")
      .select(
        "id, groupe_id, date, heure_debut, heure_fin, statut, nature, objectif_operationnel, groupes(nom), modules(nom, competences(code_operationnel))",
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
  ]);

  if (seancesRes.error) throw new Error(seancesRes.error.message);
  if (controlesRes.error) throw new Error(controlesRes.error.message);

  const seances = (seancesRes.data ?? []) as unknown as (Omit<
    SeanceCalendrier,
    "groupeNom" | "moduleNom" | "codeOperationnel" | "objectif"
  > & {
    objectif_operationnel: string | null;
    groupes: { nom: string } | null;
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
    seances: seances.map((s) => ({
      id: s.id,
      groupe_id: s.groupe_id,
      groupeNom: s.groupes?.nom ?? "—",
      moduleNom: s.modules?.nom ?? "—",
      codeOperationnel: s.modules?.competences?.code_operationnel ?? null,
      date: s.date,
      heure_debut: s.heure_debut,
      heure_fin: s.heure_fin,
      statut: s.statut,
      nature: s.nature,
      objectif: s.objectif_operationnel,
    })),
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
