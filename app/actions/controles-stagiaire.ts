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

  let lecture = supabase
    .from("controles")
    .select(
      "id, titre, type, type_efm, format, duree_heures, date_prevue, consignes, bareme_total, ouvert_le, ferme_le, statut, modules(nom, competences(code_operationnel))",
    );
  // Un test n'est au programme du stagiaire qu'une fois ouvert par le
  // formateur (PRD §4.7bis) ; la politique fait la même sélection. Le compte
  // de test voit tout le groupe, brouillons compris : il sert à essayer avant.
  if (!moi.est_test) lecture = lecture.or("type.neq.TEST,ouvert_le.not.is.null");

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
  }[];
};

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

  const { data, error } = await supabase
    .from("passations_controle")
    .select("note, responses")
    .eq("controle_id", controleId)
    .eq("stagiaire_id", moi.id)
    .maybeSingle();

  if (error || !data) return null;

  const details = (data.responses ?? []) as MaCopie["details"];
  return {
    note: Number(data.note),
    total: details.reduce((t, d) => t + Number(d.bareme ?? 0), 0),
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
