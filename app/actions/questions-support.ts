"use server";

import { createClient, getUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Support } from "@/lib/support";
import { libelleModule } from "@/lib/modules";
import { lireCorrection, type CorrectionTp } from "@/lib/correction";

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
  /**
   * Vrai tant que le formateur n'a pas validé ce message (migration 085).
   *
   * Un stagiaire ne reçoit que les siens dans cet état — la policy écarte
   * ceux des autres. Le formateur les reçoit tous, et c'est à lui de trancher.
   */
  enAttente: boolean;
};

/** Les réglages qui s'appliquent au fil d'un cours. */
export type ReglagesCommentaires = {
  /** Faux : les stagiaires ne peuvent plus écrire sous les cours. */
  ouverts: boolean;
  /** Vrai : ce qu'écrit un stagiaire attend la validation avant d'être vu. */
  valides: boolean;
};

export type QuestionSupport = Message & { reponses: Message[] };

export type SupportDetail = {
  id: string;
  contenu: Support;
  date: string | null;
  moduleNom: string | null;
  questions: QuestionSupport[];
  /** Pour savoir, côté stagiaire, s'il y a lieu de proposer le champ. */
  reglages: ReglagesCommentaires;
  /**
   * La correction du TP, si le formateur l'a ouverte à ce groupe (§4.4).
   * La RLS décide seule : ici, `null` veut dire « pas partagée, ou pas mon
   * groupe » sans qu'on ait à refaire le test.
   */
  correction: CorrectionTp | null;
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

  // La policy `supports_lecture_stagiaire` refuse déjà les supports du
  // formateur ; le filtre le dit aussi dans la requête, pour qu'on lise ici ce
  // qui est servi sans avoir à relire la migration.
  const { data, error } = await supabase
    .from("supports_seance")
    .select(
      "id, seance_id, type, contenu, version, seances(date, modules(nom, competences(code_operationnel)))",
    )
    .eq("destinataire", "stagiaire")
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
      .select("id, auteur_id, texte, created_at, statut")
      .eq("support_id", supportId)
      .order("created_at"),
    nomsDesAuteurs(groupeId),
  ]);
  if (questionsRes.error) throw new Error(questionsRes.error.message);

  const ids = (questionsRes.data ?? []).map((q) => q.id);
  const { data: reponses, error: erreurR } = ids.length
    ? await supabase
        .from("reponses_question")
        .select("id, question_id, auteur_id, texte, created_at, statut")
        .in("question_id", ids)
        .order("created_at")
    : { data: [], error: null };
  if (erreurR) throw new Error(erreurR.message);

  const message = (m: {
    id: string;
    auteur_id: string;
    texte: string;
    created_at: string;
    statut: string;
  }): Message => ({
    id: m.id,
    texte: m.texte,
    created_at: m.created_at,
    auteurNom: noms.get(m.auteur_id) ?? "Formateur",
    auteurFormateur: !noms.has(m.auteur_id),
    estMien: m.auteur_id === user?.id,
    enAttente: m.statut === "en_attente",
  });

  return (questionsRes.data ?? []).map((q) => ({
    ...message(q),
    reponses: (reponses ?? [])
      .filter((r) => r.question_id === q.id)
      .map(message),
  }));
}

export async function getSupportDetail(
  supportId: string,
): Promise<SupportDetail | null> {
  const supabase = await createClient();

  // Lu par identifiant : le filtre compte double ici, un identifiant pouvant
  // être collé dans l'URL. La policy reste la garantie, il en est la trace.
  const { data, error } = await supabase
    .from("supports_seance")
    .select(
      "id, contenu, seance_id, seances(date, modules(nom, competences(code_operationnel)), seance_groupes(groupe_id))",
    )
    .eq("id", supportId)
    .eq("destinataire", "stagiaire")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const s = data as unknown as {
    id: string;
    contenu: Support;
    seance_id: string;
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
    reglages: await getReglagesCommentaires(
      s.seances?.seance_groupes[0]?.groupe_id ?? "",
    ),
    correction: await correctionVisible(s.seance_id),
  };
}

/**
 * La correction que ce lecteur a le droit de voir, s'il y en a une.
 *
 * Aucun filtre n'est écrit ici : la policy `corrections_tp_lecture_stagiaire`
 * exige à la fois le drapeau de partage et l'appartenance au groupe. Redoubler
 * la règle dans le code la ferait diverger le jour où l'une des deux change.
 */
async function correctionVisible(
  seanceId: string,
): Promise<CorrectionTp | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("corrections_tp")
    .select("contenu")
    .eq("seance_id", seanceId)
    .eq("partagee_avec_stagiaires", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? lireCorrection(data.contenu) : null;
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
  revalidatePath("/groupes", "layout");
}

export async function repondreQuestion(
  questionId: string,
  texte: string,
  supportId: string,
) {
  const propre = texte.trim();
  if (!propre) throw new Error("La réponse est vide.");
  // Vingt mille : le plafond du formateur, qui répond en Markdown. Celui d'un
  // stagiaire, deux mille, est tenu par `repondre_question` en base
  // (migration 086) — l'action ne sait pas qui écrit sans une lecture de plus,
  // et la fonction, elle, le sait déjà.
  if (propre.length > 20000) {
    throw new Error("La réponse dépasse 20 000 caractères.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("repondre_question", {
    p_question_id: questionId,
    p_texte: propre,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/espace-stagiaire/cours/${supportId}`);
  revalidatePath("/groupes", "layout");
}

/**
 * Les réglages du fil de cours pour un groupe.
 *
 * Lus par une fonction et non dans `parametres_formateur` : un stagiaire n'a
 * pas accès à cette table, et doit pourtant savoir si le champ de saisie a
 * lieu d'être. Faute de ligne — un formateur qui n'a jamais ouvert ses
 * paramètres — les valeurs par défaut s'appliquent, comme en base.
 */
export async function getReglagesCommentaires(
  groupeId: string,
): Promise<ReglagesCommentaires> {
  if (!groupeId) return { ouverts: true, valides: true };
  const supabase = await createClient();
  const { data } = await supabase
    .rpc("reglages_commentaires_groupe", { p_groupe: groupeId })
    .maybeSingle();
  return {
    ouverts: data?.ouverts ?? true,
    valides: data?.valides ?? true,
  };
}

/** Les réglages du formateur connecté, pour l'écran de paramètres. */
export async function getMesReglagesCommentaires(): Promise<ReglagesCommentaires> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("parametres_formateur")
    .select("commentaires_cours_ouverts, commentaires_cours_valides")
    .maybeSingle();
  return {
    ouverts: data?.commentaires_cours_ouverts ?? true,
    valides: data?.commentaires_cours_valides ?? true,
  };
}

/**
 * Enregistre les deux interrupteurs.
 *
 * `upsert` sur les deux seules colonnes concernées : la ligne porte aussi la
 * charge horaire et l'identité de l'établissement, qu'on ne doit pas
 * réécrire au passage.
 */
export async function enregistrerReglagesCommentaires(
  reglages: ReglagesCommentaires,
): Promise<void> {
  const user = await getUser();
  if (!user) throw new Error("Authentification requise.");

  const supabase = await createClient();
  const { error } = await supabase.from("parametres_formateur").upsert(
    {
      formateur_id: user.id,
      commentaires_cours_ouverts: reglages.ouverts,
      commentaires_cours_valides: reglages.valides,
    },
    { onConflict: "formateur_id" },
  );
  if (error) throw new Error(error.message);

  revalidatePath("/parametres");
  revalidatePath("/groupes", "layout");
  revalidatePath("/espace-stagiaire", "layout");
}

/**
 * Valide une question ou une réponse de stagiaire.
 *
 * Passe par une fonction en base qui ne touche qu'au statut : le formateur
 * rend un message visible, il ne réécrit pas ce qu'un stagiaire a signé.
 */
export async function publierMessage(
  genre: "question" | "reponse",
  id: string,
  supportId: string,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("publier_message_cours", {
    p_genre: genre,
    p_id: id,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/espace-stagiaire/cours/${supportId}`);
  revalidatePath("/groupes", "layout");
}

/**
 * Supprime une question — et ses réponses, en cascade — ou une réponse.
 *
 * La policy tranche : le formateur du groupe supprime tout, un stagiaire ses
 * seuls messages. On vérifie qu'une ligne est bien partie, sans quoi un refus
 * de la policy passerait pour un succès — PostgREST ne signale pas une
 * suppression qui ne trouve rien à supprimer.
 */
export async function supprimerMessage(
  genre: "question" | "reponse",
  id: string,
  supportId: string,
): Promise<void> {
  const supabase = await createClient();
  const table =
    genre === "question" ? "questions_support" : "reponses_question";
  const { data, error } = await supabase
    .from(table)
    .delete()
    .eq("id", id)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Ce message n'a pas pu être supprimé.");
  }
  revalidatePath(`/espace-stagiaire/cours/${supportId}`);
  revalidatePath("/groupes", "layout");
}
