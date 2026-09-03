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
  created_at: string;
};

const COLONNES_CONTROLE =
  "id, groupe_id, module_id, titre, consignes, duree_heures, type, type_efm, " +
  "date_prevue, date_administration, format, statut, created_at";

export type TypeQuestion = "qcm" | "ouverte" | "exercice";
export type OptionQcm = { texte: string; correcte: boolean };

/**
 * Place d'une question dans la courbe de difficulté (PRD §4.7).
 *
 * `null` sur une question saisie à la main : la calibration vient de la
 * génération, la supposer accessible fausserait le calcul du socle.
 */
export type Difficulte = "accessible" | "discriminant" | null;

export type Question = {
  id: string;
  controle_id: string;
  type: TypeQuestion;
  enonce: string | null;
  bareme: number;
  /** QCM uniquement : propositions à cocher. */
  options: OptionQcm[];
  corrige: string | null;
  difficulte: Difficulte;
  /** Pourquoi ce barème correspond à cette difficulté. */
  justification_bareme: string | null;
  position: number;
};

export type ControleDetail = Controle & { questions: Question[] };

export type QuestionInput = {
  type: TypeQuestion;
  enonce: string;
  bareme: number;
  options: OptionQcm[];
  corrige: string | null;
  difficulte?: Difficulte;
  justification_bareme?: string | null;
};

/** Ligne prête pour la base, propositions normalisées. */
function versLigneQuestion(q: QuestionInput, controleId: string, i: number) {
  const options = q.type === "qcm"
    ? q.options
        .filter((o) => o.texte.trim())
        .map((o) => ({ texte: o.texte.trim(), correcte: Boolean(o.correcte) }))
    : null;

  if (q.type === "qcm" && (!options || options.length < 2)) {
    throw new Error(
      `La question ${i + 1} est un QCM : elle doit comporter au moins deux propositions.`,
    );
  }

  return {
    controle_id: controleId,
    type: q.type,
    enonce: q.enonce,
    bareme: q.bareme,
    options,
    corrige: q.corrige,
    difficulte: q.difficulte ?? null,
    justification_bareme: q.justification_bareme ?? null,
    position: i,
  };
}

export type PassationDetail = {
  question_id: string;
  enonce: string;
  bareme: number;
  /** `null` tant que la question n'a pas été corrigée. */
  points: number | null;
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
    .select(
      "id, controle_id, type, enonce, bareme, options, corrige, difficulte, justification_bareme, position",
    )
    .eq("controle_id", id)
    .order("position");

  if (errQ) throw new Error(errQ.message);

  return {
    ...(controle as unknown as Controle),
    questions: ((questions ?? []) as unknown as Question[]).map((q) => ({
      ...q,
      options: Array.isArray(q.options) ? q.options : [],
    })),
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
    const { error: errQ } = await supabase
      .from("questions_controle")
      .insert(input.questions.map((q, i) => versLigneQuestion(q, data.id, i)));
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
    const { error: errIns } = await supabase
      .from("questions_controle")
      .insert(input.questions.map((q, i) => versLigneQuestion(q, id, i)));
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
    .select("id, controle_id, nom_complet, email, note, responses, submitted_at")
    .eq("controle_id", controleId)
    .order("submitted_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Passation[];
}

/**
 * Enregistre la correction d'une copie : points et commentaires question par
 * question, et la note qui en découle.
 *
 * La note n'est pas passée à part par confort : elle est recalculée ici depuis
 * les points, pour qu'aucun appel ne puisse afficher une note qui ne
 * corresponde pas au détail.
 */
export async function corrigerPassation(
  passationId: string,
  responses: PassationDetail[],
) {
  const supabase = await createClient();

  const note = responses.reduce(
    (somme, r) => somme + (Number(r.points) || 0),
    0,
  );

  const { error } = await supabase.rpc("corriger_passation", {
    p_passation_id: passationId,
    p_responses: responses,
    p_note: Math.min(20, Math.max(0, note)),
  });

  if (error) throw new Error(error.message);
  revalidatePath("/modules");
  return note;
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
    .select(
      "id, table_name, ligne_id, action, ancienne_valeur, nouvelle_valeur, utilisateur, date",
    )
    .in("ligne_id", ids)
    .order("date", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as AuditEntry[];
}


export type SeanceCouverte = {
  id: string;
  date: string | null;
  statut: string;
  nature: "theorique" | "pratique" | null;
  duree: number | null;
  objectif: string | null;
  contenu: string | null;
};

export type ContenuCouvert = {
  seances: SeanceCouverte[];
  heures: number;
  /** Total du module, pour situer la part couverte par un contrôle continu. */
  heuresModule: number;
  seancesModule: number;
};

/**
 * Contenu de référence d'un contrôle.
 *
 * Un contrôle continu porte sur ce qui a été fait à ce jour ; une épreuve de
 * fin de module porte sur le module entier, y compris les séances à venir.
 * Confondre les deux ferait interroger les stagiaires sur ce qu'ils n'ont pas
 * encore vu, ou dispenserait l'EFM de la moitié du programme.
 */
export async function getContenuCouvert(
  groupeId: string,
  moduleId: string,
  type: TypeControle,
): Promise<ContenuCouvert> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("seances")
    .select(
      "id, date, statut, nature, duree_realisee, duree_prevue, objectif_operationnel, contenu_prevu, contenu_realise, created_at, seance_groupes!inner(groupe_id)",
    )
    .eq("seance_groupes.groupe_id", groupeId)
    .eq("module_id", moduleId)
    .order("date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  const toutes = (data ?? []) as unknown as {
    id: string;
    date: string | null;
    statut: string;
    nature: "theorique" | "pratique" | null;
    duree_realisee: number | null;
    duree_prevue: number | null;
    objectif_operationnel: string | null;
    contenu_prevu: string | null;
    contenu_realise: string | null;
  }[];

  const retenues = type === "EFM" ? toutes : toutes.filter((s) => s.statut === "fait");

  const duree = (s: (typeof toutes)[number]) =>
    Number(s.duree_realisee ?? s.duree_prevue ?? 0);

  return {
    seances: retenues.map((s) => ({
      id: s.id,
      date: s.date,
      statut: s.statut,
      nature: s.nature,
      duree: duree(s) || null,
      objectif: s.objectif_operationnel,
      contenu:
        s.statut === "fait"
          ? (s.contenu_realise ?? s.contenu_prevu)
          : s.contenu_prevu,
    })),
    heures: retenues.reduce((t, s) => t + duree(s), 0),
    heuresModule: toutes.reduce((t, s) => t + duree(s), 0),
    seancesModule: toutes.length,
  };
}
