"use server";

import { createClient, getUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Support } from "@/lib/support";
import { libelleModule } from "@/lib/modules";

export type SupportListe = {
  id: string;
  titre: string;
  type: "theorique" | "pratique";
  seanceId: string;
  date: string | null;
  moduleNom: string | null;
  questions: number;
};

export type Message = {
  id: string;
  texte: string;
  created_at: string;
  auteurNom: string;
  /** Vrai si l'auteur est le formateur et non un stagiaire du groupe. */
  auteurFormateur: boolean;
  estMien: boolean;
};

export type QuestionSupport = Message & { reponses: Message[] };

export type SupportDetail = {
  id: string;
  contenu: Support;
  date: string | null;
  moduleNom: string | null;
  questions: QuestionSupport[];
};

/** Titre lisible d'un support, quel que soit son type. */
function titreSupport(contenu: unknown, secours: string): string {
  const t = (contenu as { titre?: unknown } | null)?.titre;
  return typeof t === "string" && t.trim() ? t : secours;
}

/**
 * Supports consultables par le stagiaire : la dernière version de chaque
 * séance de son groupe. La RLS écarte les séances des autres groupes ; la
 * fiche de préparation, elle, reste hors de portée (migration 038).
 */
export async function getMesSupports(): Promise<SupportListe[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("supports_seance")
    .select(
      "id, seance_id, type, contenu, version, seances(date, modules(nom, competences(code_operationnel)))",
    )
    .order("version", { ascending: false });

  if (error) throw new Error(error.message);

  // Une séance, un support : on garde la version la plus haute.
  const parSeance = new Map<string, SupportListe>();
  for (const ligne of data ?? []) {
    const r = ligne as unknown as {
      id: string;
      seance_id: string;
      type: "theorique" | "pratique";
      contenu: unknown;
      seances: {
        date: string | null;
        modules: {
          nom: string;
          competences: { code_operationnel: string | null } | null;
        } | null;
      } | null;
    };
    if (parSeance.has(r.seance_id)) continue;
    parSeance.set(r.seance_id, {
      id: r.id,
      titre: titreSupport(r.contenu, r.seances?.modules?.nom ?? "Support"),
      type: r.type,
      seanceId: r.seance_id,
      date: r.seances?.date ?? null,
      moduleNom: r.seances?.modules
        ? libelleModule(
            r.seances.modules.competences?.code_operationnel,
            r.seances.modules.nom,
          )
        : null,
      questions: 0,
    });
  }

  const supports = [...parSeance.values()];
  if (supports.length === 0) return [];

  const { data: questions, error: erreurQ } = await supabase
    .from("questions_support")
    .select("support_id")
    .in(
      "support_id",
      supports.map((s) => s.id),
    );
  if (erreurQ) throw new Error(erreurQ.message);

  for (const q of questions ?? []) {
    const s = supports.find((x) => x.id === q.support_id);
    if (s) s.questions += 1;
  }

  // Le plus récent d'abord : on révise le dernier cours, pas le premier.
  return supports.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

/** Résout les noms des auteurs : hors stagiaires du groupe, c'est le formateur. */
async function nomsDesAuteurs(groupeId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stagiaires")
    .select("user_id, nom, prenom")
    .eq("groupe_id", groupeId);

  // Sans ce contrôle, une lecture en échec affichait tout le monde comme
  // « Formateur » — un fil de discussion faux, sans rien qui le signale.
  if (error) throw new Error(error.message);

  const noms = new Map<string, string>();
  for (const s of data ?? []) {
    if (s.user_id) noms.set(s.user_id, `${s.prenom} ${s.nom}`);
  }
  return noms;
}

/**
 * Questions d'un support, avec leurs réponses et le nom de chaque auteur.
 *
 * Sert aux deux espaces : le stagiaire les lit sous son cours, le formateur
 * sous le support qu'il a rédigé.
 */
export async function chargerQuestions(
  supportId: string,
  groupeId: string,
): Promise<QuestionSupport[]> {
  const supabase = await createClient();
  const user = await getUser();

  const [questionsRes, noms] = await Promise.all([
    supabase
      .from("questions_support")
      .select("id, auteur_id, texte, created_at")
      .eq("support_id", supportId)
      .order("created_at"),
    nomsDesAuteurs(groupeId),
  ]);
  if (questionsRes.error) throw new Error(questionsRes.error.message);

  const ids = (questionsRes.data ?? []).map((q) => q.id);
  const { data: reponses, error: erreurR } = ids.length
    ? await supabase
        .from("reponses_question")
        .select("id, question_id, auteur_id, texte, created_at")
        .in("question_id", ids)
        .order("created_at")
    : { data: [], error: null };
  if (erreurR) throw new Error(erreurR.message);

  const message = (m: {
    id: string;
    auteur_id: string;
    texte: string;
    created_at: string;
  }): Message => ({
    id: m.id,
    texte: m.texte,
    created_at: m.created_at,
    auteurNom: noms.get(m.auteur_id) ?? "Formateur",
    auteurFormateur: !noms.has(m.auteur_id),
    estMien: m.auteur_id === user?.id,
  });

  return (questionsRes.data ?? []).map((q) => ({
    ...message(q),
    reponses: (reponses ?? []).filter((r) => r.question_id === q.id).map(message),
  }));
}

export async function getSupportDetail(
  supportId: string,
): Promise<SupportDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("supports_seance")
    .select("id, contenu, seances(date, modules(nom, competences(code_operationnel)), seance_groupes(groupe_id))")
    .eq("id", supportId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const s = data as unknown as {
    id: string;
    contenu: Support;
    seances: {
      date: string | null;
      modules: {
        nom: string;
        competences: { code_operationnel: string | null } | null;
      } | null;
      seance_groupes: { groupe_id: string }[];
    } | null;
  };

  return {
    id: s.id,
    contenu: s.contenu,
    date: s.seances?.date ?? null,
    moduleNom: s.seances?.modules
      ? libelleModule(
          s.seances.modules.competences?.code_operationnel,
          s.seances.modules.nom,
        )
      : null,
    // Une séance FAD partagée a plusieurs groupes ; les questions posées
    // sur son support le sont depuis l'un d'eux.
    questions: await chargerQuestions(
      s.id,
      s.seances?.seance_groupes[0]?.groupe_id ?? "",
    ),
  };
}

/** Le contexte archivé est dérivé du support côté base, jamais transmis ici. */
export async function poserQuestion(supportId: string, texte: string) {
  const propre = texte.trim();
  if (!propre) throw new Error("La question est vide.");
  if (propre.length > 2000) {
    throw new Error("La question dépasse 2000 caractères.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("poser_question_support", {
    p_support_id: supportId,
    p_texte: propre,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/espace-stagiaire/cours/${supportId}`);
  revalidatePath("/groupes");
}

export async function repondreQuestion(
  questionId: string,
  texte: string,
  supportId: string,
) {
  const propre = texte.trim();
  if (!propre) throw new Error("La réponse est vide.");
  if (propre.length > 2000) {
    throw new Error("La réponse dépasse 2000 caractères.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("repondre_question", {
    p_question_id: questionId,
    p_texte: propre,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/espace-stagiaire/cours/${supportId}`);
  revalidatePath("/groupes");
}
