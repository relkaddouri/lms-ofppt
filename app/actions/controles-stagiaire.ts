"use server";

import { createClient, getUser } from "@/lib/supabase/server";

export type ControleStagiaire = {
  id: string;
  titre: string | null;
  type: "CC" | "EFM";
  type_efm: "local" | "regional" | null;
  format: string | null;
  duree_heures: number | null;
  date_prevue: string | null;
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
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!moi) return [];

  const [controlesRes, passationsRes] = await Promise.all([
    supabase
      .from("controles")
      .select(
        "id, titre, type, type_efm, format, duree_heures, date_prevue, modules(nom, competences(code_operationnel))",
      )
      .order("date_prevue", { nullsFirst: false }),
    supabase
      .from("passations_controle")
      .select("id, controle_id, note")
      .eq("stagiaire_id", moi.id),
  ]);

  if (controlesRes.error) throw new Error(controlesRes.error.message);
  if (passationsRes.error) throw new Error(passationsRes.error.message);

  const parControle = new Map(
    (passationsRes.data ?? []).map((p) => [p.controle_id, p]),
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
      moduleNom: c.modules?.nom ?? null,
      codeOperationnel: c.modules?.competences?.code_operationnel ?? null,
      note: p ? Number(p.note) : null,
      passationId: p?.id ?? null,
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
