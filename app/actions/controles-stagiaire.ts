"use server";

import { createClient, getUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { revalidatePath } from "next/cache";

export type ControleStagiaire = {
  id: string;
  titre: string | null;
  type: "CC" | "EFM" | "TEST";
  type_efm: "local" | "regional" | null;
  format: string | null;
  duree_heures: number | null;
  date_prevue: string | null;
  /** Les consignes générales, lues avant la première question. */
  consignes: string | null;
  /** Contrôle de test : total libre, et fenêtre d'ouverture. */
  bareme_total: number | null;
  ouvert_le: string | null;
  ferme_le: string | null;
  /** Brouillon : visible du seul compte de test du formateur. */
  statut: "brouillon" | "valide";
  /** Le stagiaire connecté est le compte de test du formateur (migration 093). */
  compteTest: boolean;
  moduleNom: string | null;
  codeOperationnel: string | null;
  /** Note obtenue, si la copie a été rendue. */
  note: number | null;
  passationId: string | null;
};

export type QuestionSujet = {
  id: string;
  type: "qcm" | "ouverte" | "exercice" | null;
  enonce: string;
  /** Le matériau de la question — observations, tableau —, à lire avant de répondre. */
  donnees: string | null;
  bareme: number;
  options: { texte: string }[] | null;
};

/** Contrôles validés du groupe du stagiaire, avec sa copie éventuelle. */
export async function getMesControles(): Promise<ControleStagiaire[]> {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return [];

  const { data: moi } = await supabase
    .from("stagiaires")
    .select("id, est_test")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!moi) return [];

  // Aucun contrôle n'est au programme du stagiaire avant que le formateur ne
  // l'ouvre (migration 096) ; la politique fait la même sélection, et laisse
  // passer une copie déjà rendue. Le compte de test, lui, voit tout le groupe,
  // brouillons compris : il sert à essayer avant.
  const lecture = supabase
    .from("controles")
    .select(
      "id, titre, type, type_efm, format, duree_heures, date_prevue, consignes, bareme_total, ouvert_le, ferme_le, statut, modules(nom, competences(code_operationnel))",
    );

  const [controlesRes, passationsRes] = await Promise.all([
    lecture
      // Le test le plus récemment ouvert en tête : c'est celui qu'on vient
      // d'annoncer au groupe.
      .order("ouvert_le", { ascending: false, nullsFirst: false })
      .order("date_prevue", { nullsFirst: false }),
    supabase
      .from("passations_controle")
      .select("id, controle_id, note")
      .eq("stagiaire_id", moi.id),
  ]);

  // Deux lectures et non une : depuis la migration 077, la policy ferme la
  // table tant que le résultat n'est pas publié. `v_mes_remises` dit qu'une
  // copie a été rendue sans jamais dire ce qu'elle vaut — sans elle, une copie
  // en attente disparaîtrait de l'écran et le stagiaire croirait l'avoir
  // perdue.
  const remisesRes = await supabase
    .from("v_mes_remises")
    .select("id, controle_id")
    .eq("stagiaire_id", moi.id);

  if (controlesRes.error) throw new Error(controlesRes.error.message);
  if (passationsRes.error) throw new Error(passationsRes.error.message);
  if (remisesRes.error) throw new Error(remisesRes.error.message);

  const parControle = new Map(
    (passationsRes.data ?? []).map((p) => [p.controle_id, p]),
  );
  const remisPour = new Map(
    (remisesRes.data ?? []).map((r) => [r.controle_id, r.id]),
  );

  return (
    controlesRes.data as unknown as (Omit<
      ControleStagiaire,
      "moduleNom" | "codeOperationnel" | "note" | "passationId"
    > & {
      modules: {
        nom: string;
        competences: { code_operationnel: string | null } | null;
      } | null;
    })[]
  ).map((c) => {
    const p = parControle.get(c.id);
    return {
      id: c.id,
      titre: c.titre,
      type: c.type,
      type_efm: c.type_efm,
      format: c.format,
      duree_heures: c.duree_heures,
      date_prevue: c.date_prevue,
      consignes: c.consignes,
      bareme_total: c.bareme_total === null ? null : Number(c.bareme_total),
      ouvert_le: c.ouvert_le,
      ferme_le: c.ferme_le,
      statut: c.statut,
      compteTest: moi.est_test,
      moduleNom: c.modules?.nom ?? null,
      codeOperationnel: c.modules?.competences?.code_operationnel ?? null,
      // La note n'existe que si le formateur a publié ; la remise, elle, se
      // sait dans tous les cas.
      note: p ? Number(p.note) : null,
      passationId: p?.id ?? remisPour.get(c.id) ?? null,
    };
  });
}

/** Sujet d'un contrôle : ni corrigé, ni bonne réponse de QCM. */
export async function getSujet(controleId: string): Promise<QuestionSujet[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_sujet_pour_passation", {
    p_controle_id: controleId,
  });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as QuestionSujet[];
}

export type MaCopie = {
  note: number;
  total: number;
  details: {
    question_id: string;
    enonce: string;
    bareme: number;
    points: number;
    commentaire: string;
    reponse: string;
    /** Rendus avec la correction publiée (migration 094). */
    type: "qcm" | "ouverte" | "exercice" | null;
    donnees: string | null;
    /** Pour un QCM, toutes les propositions avec celles qui sont justes. */
    options: { texte: string; correcte: boolean }[];
    /** La réponse attendue. */
    corrige: string | null;
  }[];
};

/**
 * La copie du stagiaire connecté, avec sa correction.
 *
 * Null tant que le résultat n'est pas publié : la politique ferme la copie, et
 * la correction ne sort pas davantage. Une fois publiée, chaque question
 * porte ce qu'il faut pour comparer — sa réponse, la bonne, les points et le
 * commentaire du formateur (qui peut avoir revu celui du correcteur).
 */
export async function getMaCopie(controleId: string): Promise<MaCopie | null> {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return null;

  const { data: moi } = await supabase
    .from("stagiaires")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!moi) return null;

  const [copieRes, correctionRes] = await Promise.all([
    supabase
      .from("passations_controle")
      .select("note, responses")
      .eq("controle_id", controleId)
      .eq("stagiaire_id", moi.id)
      .maybeSingle(),
    supabase.rpc("get_ma_correction", { p_controle_id: controleId }),
  ]);

  const data = copieRes.data;
  if (copieRes.error || !data) return null;

  type Enregistre = {
    question_id: string;
    enonce?: string | null;
    bareme?: number | string | null;
    points?: number | string | null;
    commentaire?: string | null;
    reponse?: string | null;
    corrige?: string | null;
  };
  const enregistres = (Array.isArray(data.responses) ? data.responses : []) as Enregistre[];
  const parQuestion = new Map(enregistres.map((d) => [d.question_id, d]));

  const questions = (correctionRes.data ?? []) as {
    question_id: string;
    type: string | null;
    enonce: string | null;
    donnees: string | null;
    bareme: number | string | null;
    options: unknown;
    corrige: string | null;
  }[];

  // L'ordre et le texte viennent des questions actuelles quand elles sont là ;
  // sinon, de ce que la copie a gardé au moment de la remise.
  const source: Enregistre[] = questions.length
    ? questions.map((q) => ({ ...parQuestion.get(q.question_id), question_id: q.question_id }))
    : enregistres;
  const questionDe = new Map(questions.map((q) => [q.question_id, q]));

  const details: MaCopie["details"] = source.map((d) => {
    const q = questionDe.get(d.question_id);
    const options = Array.isArray(q?.options)
      ? (q!.options as { texte?: string; correcte?: boolean }[]).map((o) => ({
          texte: String(o.texte ?? ""),
          correcte: Boolean(o.correcte),
        }))
      : [];
    return {
      question_id: d.question_id,
      enonce: q?.enonce ?? d.enonce ?? "",
      bareme: Number(q?.bareme ?? d.bareme ?? 0),
      points: Number(d.points ?? 0),
      commentaire: d.commentaire ?? "",
      reponse: d.reponse ?? "",
      type: (q?.type as MaCopie["details"][number]["type"]) ?? null,
      donnees: q?.donnees ?? null,
      options,
      corrige: q?.corrige ?? d.corrige ?? null,
    };
  });

  return {
    note: Number(data.note),
    total: details.reduce((t, d) => t + d.bareme, 0),
    details,
  };
}

/**
 * Efface la copie du compte de test, pour repasser le contrôle (migration 093).
 *
 * Réservé au compte de test : un vrai stagiaire ne recompose jamais. La
 * suppression passe par la clé de service — aucune politique n'ouvre la
 * suppression d'une copie à un stagiaire —, après avoir vérifié qui demande.
 */
export async function recommencerCopieDeTest(controleId: string): Promise<void> {
  const user = await getUser();
  if (!user) throw new Error("Authentification requise.");

  const supabase = await createClient();
  const { data: moi } = await supabase
    .from("stagiaires")
    .select("id, est_test")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!moi?.est_test) {
    throw new Error("Seul le compte de test peut repasser un contrôle.");
  }

  const service = createServiceClient();
  const { error } = await service
    .from("passations_controle")
    .delete()
    .eq("controle_id", controleId)
    .eq("stagiaire_id", moi.id);
  if (error) throw new Error(error.message);

  revalidatePath("/espace-stagiaire/controles");
  revalidatePath(`/espace-stagiaire/controles/${controleId}`);
}
