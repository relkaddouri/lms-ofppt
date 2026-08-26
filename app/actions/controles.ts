"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type TypeControle = "CC" | "EFM";
export type TypeEfm = "local" | "regional";
export type FormatControle = "theorique" | "pratique" | "mixte";

export type Controle = {
  id: string;
  groupe_id: string;
  module_id: string;
  titre: string | null;
  consignes: string | null;
  duree_heures: number;
  type: TypeControle;
  /** Renseigné uniquement pour un EFM. */
  type_efm: TypeEfm | null;
  date_prevue: string | null;
  date_administration: string | null;
  format: FormatControle;
  statut: "brouillon" | "valide";
  token_public: string;
  created_at: string;
};

const COLONNES_CONTROLE =
  "id, groupe_id, module_id, titre, consignes, duree_heures, type, type_efm, " +
  "date_prevue, date_administration, format, statut, token_public, created_at";

export type Question = {
  id: string;
  controle_id: string;
  enonce: string | null;
  bareme: number;
  corrige: string | null;
  position: number;
};

export type ControleDetail = Controle & { questions: Question[] };

export type QuestionInput = {
  enonce: string;
  bareme: number;
  corrige: string | null;
};

export type PassationDetail = {
  question_id: string;
  enonce: string;
  bareme: number;
  points: number;
  commentaire: string;
  corrige: string;
  reponse: string;
};

export type Passation = {
  id: string;
  controle_id: string;
  nom_complet: string;
  email: string | null;
  note: number;
  responses: PassationDetail[];
  submitted_at: string;
};

/**
 * Contrôles d'un couple groupe+module. Jamais du module seul : un contrôle
 * porte sur ce que CE groupe a réellement couvert.
 */
export async function getControles(
  groupeId: string,
  moduleId: string,
): Promise<Controle[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("controles")
    .select(COLONNES_CONTROLE)
    .eq("groupe_id", groupeId)
    .eq("module_id", moduleId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data as unknown as Controle[];
}

export async function getControle(id: string): Promise<ControleDetail | null> {
  const supabase = await createClient();

  const { data: controle, error: errC } = await supabase
    .from("controles")
    .select(COLONNES_CONTROLE)
    .eq("id", id)
    .single();

  if (errC || !controle) return null;

  const { data: questions, error: errQ } = await supabase
    .from("questions_controle")
    .select("*")
    .eq("controle_id", id)
    .order("position");

  if (errQ) throw new Error(errQ.message);

  return {
    ...(controle as unknown as Controle),
    questions: (questions ?? []) as Question[],
  };
}

export type ControleInput = {
  titre: string;
  consignes?: string;
  duree_heures: number;
  type: TypeControle;
  type_efm?: TypeEfm | null;
  format: FormatControle;
  date_prevue?: string | null;
  questions: QuestionInput[];
};

/** Un EFM est forcément local ou régional ; un CC n'a pas de sous-type. */
function qualifieEfm(input: ControleInput): TypeEfm | null {
  if (input.type !== "EFM") return null;
  if (!input.type_efm) {
    throw new Error("Un EFM doit être qualifié de local ou de régional.");
  }
  return input.type_efm;
}

export async function saveControle(
  groupeId: string,
  moduleId: string,
  input: ControleInput,
): Promise<string> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("controles")
    .insert({
      groupe_id: groupeId,
      module_id: moduleId,
      titre: input.titre,
      consignes: input.consignes || null,
      duree_heures: input.duree_heures,
      type: input.type,
      type_efm: qualifieEfm(input),
      format: input.format,
      date_prevue: input.date_prevue || null,
      statut: "brouillon",
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  if (input.questions.length) {
    const { error: errQ } = await supabase.from("questions_controle").insert(
      input.questions.map((q, i) => ({
        controle_id: data.id,
        enonce: q.enonce,
        bareme: q.bareme,
        corrige: q.corrige,
        position: i,
      })),
    );
    if (errQ) throw new Error(errQ.message);
  }

  revalidatePath(`/modules/${moduleId}/controle`);
  return data.id;
}

export async function updateControle(
  id: string,
  moduleId: string,
  input: ControleInput,
) {
  const supabase = await createClient();

  const { error: errC } = await supabase
    .from("controles")
    .update({
      titre: input.titre,
      consignes: input.consignes || null,
      duree_heures: input.duree_heures,
      type: input.type,
      type_efm: qualifieEfm(input),
      format: input.format,
      date_prevue: input.date_prevue || null,
    })
    .eq("id", id);

  if (errC) throw new Error(errC.message);

  const { error: errDel } = await supabase
    .from("questions_controle")
    .delete()
    .eq("controle_id", id);

  if (errDel) throw new Error(errDel.message);

  if (input.questions.length) {
    const { error: errIns } = await supabase.from("questions_controle").insert(
      input.questions.map((q, i) => ({
        controle_id: id,
        enonce: q.enonce,
        bareme: q.bareme,
        corrige: q.corrige,
        position: i,
      })),
    );
    if (errIns) throw new Error(errIns.message);
  }

  revalidatePath(`/modules/${moduleId}/controle`);
}

export async function setControleStatut(
  id: string,
  moduleId: string,
  statut: "brouillon" | "valide",
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("controles")
    .update({ statut })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath(`/modules/${moduleId}/controle`);
}

export async function deleteControle(id: string, moduleId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("controles").delete().eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath(`/modules/${moduleId}/controle`);
}

export async function getPassations(controleId: string): Promise<Passation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("passations_controle")
    .select("*")
    .eq("controle_id", controleId)
    .order("submitted_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Passation[];
}

export type AuditEntry = {
  id: string;
  table_name: string;
  ligne_id: string;
  action: string;
  ancienne_valeur: Record<string, unknown> | null;
  nouvelle_valeur: Record<string, unknown> | null;
  utilisateur: string | null;
  date: string;
};

export async function getModuleAudit(
  groupeId: string,
  moduleId: string,
): Promise<AuditEntry[]> {
  const supabase = await createClient();

  const { data: controles, error: errC } = await supabase
    .from("controles")
    .select("id")
    .eq("groupe_id", groupeId)
    .eq("module_id", moduleId);

  if (errC) throw new Error(errC.message);

  const ids = (controles ?? []).map((c) => c.id);
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from("audit_log")
    .select("*")
    .in("ligne_id", ids)
    .order("date", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as AuditEntry[];
}
