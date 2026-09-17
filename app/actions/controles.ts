"use server";

import { createClient } from "@/lib/supabase/server";
import { getEtablissement } from "@/app/actions/etablissement";
import { formatDate, formatDateJour } from "@/lib/format";
import { dureeEnTexte, finEpreuve, formatHeure } from "@/lib/creneaux";
import type { Identification, ResultatControle } from "@/lib/resultat";
import { revalidatePath } from "next/cache";
import type { Json } from "@/lib/supabase/database.types";

/**
 * CC et EFM : les évaluations réglementaires. TEST : un contrôle de test,
 * formatif — hors minimum réglementaire, hors échéances, hors moyenne, barème
 * libre (PRD §4.7bis).
 */
export type TypeControle = "CC" | "EFM" | "TEST";
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
  /** Total visé d'un contrôle de test ; null pour un CC ou un EFM. */
  bareme_total: number | null;
  /** Séances retenues à l'étape « Contenu couvert ». */
  seance_ids: string[] | null;
  /** Contrôle de test : ouverture au groupe, et sa fin (null : sans limite). */
  ouvert_le: string | null;
  ferme_le: string | null;
  /** Renseignés par `getControles`, pour présenter la liste sans ouvrir chaque contrôle. */
  nb_questions?: number;
  total_questions?: number;
};

const COLONNES_CONTROLE =
  "id, groupe_id, module_id, titre, consignes, duree_heures, type, type_efm, " +
  "date_prevue, date_administration, format, statut, created_at, bareme_total, seance_ids, ouvert_le, ferme_le";

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
  /**
   * Le matériau de la question — observations, tableau —, en Markdown
   * (migration 088). Il fait partie du sujet : montré au stagiaire pendant la
   * passation, imprimé, transmis au correcteur.
   */
  donnees: string | null;
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
  donnees?: string | null;
  bareme: number;
  options: OptionQcm[];
  corrige: string | null;
  difficulte?: Difficulte;
  justification_bareme?: string | null;
};

/** Ligne prête pour la base, propositions normalisées. */
function versLigneQuestion(q: QuestionInput, controleId: string, i: number) {
  const options =
    q.type === "qcm"
      ? q.options
          .filter((o) => o.texte.trim())
          .map((o) => ({
            texte: o.texte.trim(),
            correcte: Boolean(o.correcte),
          }))
      : null;

  // Un QCM incomplet s'enregistre : un brouillon n'a pas à être fini. C'est
  // la validation qui l'exige (`setControleStatut`), pas l'enregistrement.
  return {
    controle_id: controleId,
    type: q.type,
    enonce: q.enonce,
    donnees: q.donnees?.trim() || null,
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
  /**
   * Le CEF du stagiaire, quand la copie est rattachée à son compte.
   *
   * Nul pour les copies antérieures au rattachement (migration 038), qui
   * n'étaient identifiées que par le nom saisi au clavier.
   */
  cef?: string | null;
  /** Date de publication du résultat au stagiaire, `null` tant qu'il attend. */
  publie_le?: string | null;
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
    .select(`${COLONNES_CONTROLE}, questions_controle(bareme)`)
    .eq("groupe_id", groupeId)
    .eq("module_id", moduleId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (
    data as unknown as (Controle & {
      questions_controle: { bareme: number | string | null }[] | null;
    })[]
  ).map(({ questions_controle, ...c }) => ({
    ...c,
    nb_questions: questions_controle?.length ?? 0,
    total_questions: (questions_controle ?? []).reduce(
      (t, q) => t + (Number(q.bareme) || 0),
      0,
    ),
  }));
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
      "id, controle_id, type, enonce, donnees, bareme, options, corrige, difficulte, justification_bareme, position",
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
  /** Total visé d'un test ; ignoré pour un CC ou un EFM. */
  bareme_total?: number | null;
  seance_ids?: string[] | null;
  questions: QuestionInput[];
};

/** Le total libre d'un test, 20 par défaut ; rien pour un CC ou un EFM. */
function baremeLibre(input: ControleInput): number | null {
  if (input.type !== "TEST") return null;
  const t = Number(input.bareme_total);
  return t > 0 && t <= 200 ? t : 20;
}

/** Un EFM est forcément local ou régional ; un CC n'a pas de sous-type. */
function qualifieEfm(input: ControleInput): TypeEfm | null {
  if (input.type !== "EFM") return null;
  if (!input.type_efm) {
    throw new Error("Un EFM doit être qualifié de local ou de régional.");
  }
  return input.type_efm;
}

// ── Versions (PRD §4.7bis, migration 089) ────────────────────────────────

export type OrigineVersion = "enregistrement" | "restauration" | "duplication";

export type VersionControle = {
  id: string;
  numero: number;
  origine: OrigineVersion;
  source_numero: number | null;
  nb_questions: number;
  total_bareme: number;
  created_at: string;
};

export type ContenuVersion = {
  titre: string | null;
  consignes: string | null;
  duree_heures: number;
  type: TypeControle;
  type_efm: TypeEfm | null;
  format: FormatControle;
  date_prevue: string | null;
  bareme_total?: number | null;
  seance_ids?: string[] | null;
  questions: QuestionInput[];
};

type Client = Awaited<ReturnType<typeof createClient>>;

/** Ce qu'une version fige : l'en-tête et les questions telles qu'écrites en base. */
function photographie(
  input: ControleInput,
  lignes: ReturnType<typeof versLigneQuestion>[],
): ContenuVersion {
  return {
    titre: input.titre,
    consignes: input.consignes || null,
    duree_heures: Number(input.duree_heures),
    type: input.type,
    type_efm: qualifieEfm(input),
    format: input.format,
    date_prevue: input.date_prevue || null,
    bareme_total: baremeLibre(input),
    seance_ids: input.seance_ids?.length ? input.seance_ids : null,
    questions: lignes.map((l) => ({
      type: l.type,
      enonce: l.enonce,
      donnees: l.donnees,
      bareme: Number(l.bareme),
      options: l.options ?? [],
      corrige: l.corrige,
      difficulte: l.difficulte,
      justification_bareme: l.justification_bareme,
    })),
  };
}

/**
 * Une écriture comparable : clés triées, nombres normalisés. `jsonb` réordonne
 * les clés à sa façon ; deux photographies identiques doivent pourtant se
 * reconnaître.
 */
function empreinte(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(empreinte).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${empreinte((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v)) && /^-?\d+(\.\d+)?$/.test(v)) {
    return String(Number(v));
  }
  return JSON.stringify(v ?? null);
}

/**
 * Ajoute une version, sauf si rien n'a changé depuis la dernière : cliquer deux
 * fois sur « Enregistrer » ne doit pas remplir l'historique de doublons.
 * Une restauration ou une duplication est toujours consignée — c'est un
 * événement, même quand le contenu revient à l'identique.
 */
async function consignerVersion(
  supabase: Client,
  controleId: string,
  contenu: ContenuVersion,
  origine: OrigineVersion,
  sourceNumero: number | null = null,
): Promise<number | null> {
  const { data: derniere, error } = await supabase
    .from("versions_controle")
    .select("numero, contenu")
    .eq("controle_id", controleId)
    .order("numero", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);

  if (
    origine === "enregistrement" &&
    derniere &&
    empreinte(derniere.contenu) === empreinte(contenu)
  ) {
    return null;
  }

  const numero = (derniere?.numero ?? 0) + 1;
  const { error: errIns } = await supabase.from("versions_controle").insert({
    controle_id: controleId,
    numero,
    origine,
    source_numero: sourceNumero,
    contenu: contenu as unknown as Json,
    nb_questions: contenu.questions.length,
    total_bareme: contenu.questions.reduce((t, q) => t + (Number(q.bareme) || 0), 0),
  });
  if (errIns) throw new Error(errIns.message);
  return numero;
}

export async function getVersionsControle(
  controleId: string,
): Promise<VersionControle[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("versions_controle")
    .select("id, numero, origine, source_numero, nb_questions, total_bareme, created_at")
    .eq("controle_id", controleId)
    .order("numero", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((v) => ({
    ...v,
    origine: v.origine as OrigineVersion,
    total_bareme: Number(v.total_bareme),
  }));
}

export async function getContenuVersion(
  versionId: string,
): Promise<(ContenuVersion & { numero: number }) | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("versions_controle")
    .select("numero, contenu")
    .eq("id", versionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const c = data.contenu as unknown as ContenuVersion;
  return {
    ...c,
    numero: data.numero,
    questions: (c.questions ?? []).map((q) => ({
      ...q,
      options: Array.isArray(q.options) ? q.options : [],
    })),
  };
}

/**
 * Un contrôle dont des stagiaires ont déjà rendu une copie ne se réécrit plus :
 * les réponses sont rangées par question, et réenregistrer recrée les
 * questions. On en fait une variante.
 */
async function refuserSiCopies(supabase: Client, controleId: string) {
  const { data: etat } = await supabase
    .from("controles")
    .select("type, ouvert_le, ferme_le")
    .eq("id", controleId)
    .maybeSingle();
  if (etat && estOuvert(etat)) {
    throw new Error(
      "Ce test est ouvert au groupe : fermez-le avant de le modifier, les stagiaires composent sur ce sujet.",
    );
  }

  const { count, error } = await supabase
    .from("passations_controle")
    .select("id", { count: "exact", head: true })
    .eq("controle_id", controleId);
  if (error) throw new Error(error.message);
  if ((count ?? 0) > 0) {
    throw new Error(
      "Ce contrôle a déjà des copies : il ne peut plus être modifié. Dupliquez-le pour en faire une variante.",
    );
  }
}

export async function saveControle(
  groupeId: string,
  moduleId: string,
  input: ControleInput,
): Promise<string> {
  const supabase = await createClient();
  const lignes = input.questions.map((q, i) => versLigneQuestion(q, "", i));

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
      bareme_total: baremeLibre(input),
      seance_ids: input.seance_ids?.length ? input.seance_ids : null,
      statut: "brouillon",
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  if (lignes.length) {
    const { error: errQ } = await supabase
      .from("questions_controle")
      .insert(lignes.map((l) => ({ ...l, controle_id: data.id })));
    if (errQ) throw new Error(errQ.message);
  }

  await consignerVersion(supabase, data.id, photographie(input, lignes), "enregistrement");

  revalidatePath(`/modules/${moduleId}/controle`);
  return data.id;
}

/**
 * Enregistre l'état affiché et consigne une version.
 *
 * `restaureDe` : le numéro de la version rechargée dans l'éditeur, quand
 * c'est un retour en arrière qu'on enregistre — l'historique le dit.
 * Rend le numéro de la version créée, ou null si rien n'avait changé.
 */
export async function updateControle(
  id: string,
  moduleId: string,
  input: ControleInput,
  restaureDe: number | null = null,
): Promise<number | null> {
  const supabase = await createClient();
  await refuserSiCopies(supabase, id);
  const lignes = input.questions.map((q, i) => versLigneQuestion(q, id, i));

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
      bareme_total: baremeLibre(input),
      seance_ids: input.seance_ids?.length ? input.seance_ids : null,
    })
    .eq("id", id);

  if (errC) throw new Error(errC.message);

  const { error: errDel } = await supabase
    .from("questions_controle")
    .delete()
    .eq("controle_id", id);

  if (errDel) throw new Error(errDel.message);

  if (lignes.length) {
    const { error: errIns } = await supabase
      .from("questions_controle")
      .insert(lignes);
    if (errIns) throw new Error(errIns.message);
  }

  const numero = await consignerVersion(
    supabase,
    id,
    photographie(input, lignes),
    restaureDe ? "restauration" : "enregistrement",
    restaureDe,
  );

  revalidatePath(`/modules/${moduleId}/controle`);
  return numero;
}

/**
 * Une variante : le contrôle tel qu'il est enregistré, copié en un brouillon
 * neuf qui garde trace de son origine. Les copies des stagiaires restent sur
 * l'original.
 */
export async function dupliquerControle(
  controleId: string,
  moduleId: string,
): Promise<string> {
  const source = await getControle(controleId);
  if (!source) throw new Error("Contrôle introuvable.");

  const supabase = await createClient();
  const input: ControleInput = {
    titre: `${source.titre ?? "Contrôle"} — variante`,
    consignes: source.consignes ?? undefined,
    duree_heures: Number(source.duree_heures),
    type: source.type,
    type_efm: source.type_efm,
    format: source.format,
    date_prevue: null,
    bareme_total: source.bareme_total,
    seance_ids: source.seance_ids,
    questions: source.questions.map((q) => ({
      type: q.type,
      enonce: q.enonce ?? "",
      donnees: q.donnees,
      bareme: Number(q.bareme) || 0,
      options: q.options,
      corrige: q.corrige,
      difficulte: q.difficulte,
      justification_bareme: q.justification_bareme,
    })),
  };
  const lignes = input.questions.map((q, i) => versLigneQuestion(q, "", i));

  const { data, error } = await supabase
    .from("controles")
    .insert({
      groupe_id: source.groupe_id,
      module_id: source.module_id,
      titre: input.titre,
      consignes: input.consignes || null,
      duree_heures: input.duree_heures,
      type: input.type,
      type_efm: qualifieEfm(input),
      format: input.format,
      bareme_total: baremeLibre(input),
      seance_ids: input.seance_ids?.length ? input.seance_ids : null,
      statut: "brouillon",
      duplique_de: source.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (lignes.length) {
    const { error: errQ } = await supabase
      .from("questions_controle")
      .insert(lignes.map((l) => ({ ...l, controle_id: data.id })));
    if (errQ) throw new Error(errQ.message);
  }

  const { data: derniere } = await supabase
    .from("versions_controle")
    .select("numero")
    .eq("controle_id", source.id)
    .order("numero", { ascending: false })
    .limit(1)
    .maybeSingle();
  await consignerVersion(
    supabase,
    data.id,
    photographie(input, lignes),
    "duplication",
    derniere?.numero ?? null,
  );

  revalidatePath(`/modules/${moduleId}/controle`);
  return data.id;
}

/** Vrai si un contrôle de test se compose en ce moment. */
function estOuvert(c: {
  type: string;
  ouvert_le: string | null;
  ferme_le: string | null;
}): boolean {
  if (c.type !== "TEST" || !c.ouvert_le) return false;
  const maintenant = Date.now();
  return (
    new Date(c.ouvert_le).getTime() <= maintenant &&
    (!c.ferme_le || new Date(c.ferme_le).getTime() > maintenant)
  );
}

/**
 * Ouvre un contrôle de test au groupe (PRD §4.7bis).
 *
 * `dureeMinutes` : null pour un test ouvert jusqu'à ce que le formateur le
 * ferme ; sinon le test se ferme seul au bout de ce temps — c'est ce qui le
 * rend chronométré. Rouvrir un test fermé est permis : ceux qui ont déjà
 * rendu leur copie ne peuvent pas la rendre une seconde fois.
 */
export async function ouvrirTest(
  id: string,
  moduleId: string,
  dureeMinutes: number | null,
): Promise<{ ouvert_le: string; ferme_le: string | null }> {
  const supabase = await createClient();
  const { data: c, error } = await supabase
    .from("controles")
    .select("type, statut, questions_controle(id)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!c) throw new Error("Contrôle introuvable.");
  if (c.type !== "TEST") {
    throw new Error("Seul un contrôle de test s'ouvre et se ferme au groupe.");
  }
  if (c.statut !== "valide") {
    throw new Error("Validez d'abord le test : on n'ouvre pas un brouillon aux stagiaires.");
  }
  if ((c.questions_controle ?? []).length === 0) {
    throw new Error("Ce test n'a aucune question.");
  }

  const duree = dureeMinutes === null ? null : Math.round(Number(dureeMinutes));
  if (duree !== null && !(duree >= 5 && duree <= 600)) {
    throw new Error("La durée d'un test chronométré va de 5 minutes à 10 heures.");
  }

  const ouvert = new Date();
  const ferme = duree === null ? null : new Date(ouvert.getTime() + duree * 60_000);
  const valeurs = {
    ouvert_le: ouvert.toISOString(),
    ferme_le: ferme ? ferme.toISOString() : null,
  };
  const { error: errMaj } = await supabase
    .from("controles")
    .update(valeurs)
    .eq("id", id);
  if (errMaj) throw new Error(errMaj.message);

  revalidatePath(`/modules/${moduleId}/controle`);
  return valeurs;
}

/** Ferme un test ouvert : plus aucune copie n'est acceptée. */
export async function fermerTest(
  id: string,
  moduleId: string,
): Promise<{ ferme_le: string }> {
  const supabase = await createClient();
  const ferme_le = new Date().toISOString();
  const { data, error } = await supabase
    .from("controles")
    .update({ ferme_le })
    .eq("id", id)
    .eq("type", "TEST")
    .not("ouvert_le", "is", null)
    .select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Ce test n'a jamais été ouvert.");
  revalidatePath(`/modules/${moduleId}/controle`);
  return { ferme_le };
}

export async function setControleStatut(
  id: string,
  moduleId: string,
  statut: "brouillon" | "valide",
) {
  const supabase = await createClient();

  if (statut === "brouillon") {
    const { data: etat } = await supabase
      .from("controles")
      .select("type, ouvert_le, ferme_le")
      .eq("id", id)
      .maybeSingle();
    if (etat && estOuvert(etat)) {
      throw new Error("Fermez d'abord le test : il est ouvert au groupe.");
    }
  }

  // Un brouillon peut être incomplet ; un contrôle validé, non.
  if (statut === "valide") {
    const { data: qs, error: errQ } = await supabase
      .from("questions_controle")
      .select("type, options, enonce, position")
      .eq("controle_id", id)
      .order("position");
    if (errQ) throw new Error(errQ.message);
    if (!qs || qs.length === 0) {
      throw new Error("Un contrôle sans question ne peut pas être validé.");
    }
    qs.forEach((q, i) => {
      if (!q.enonce?.trim()) {
        throw new Error(`La question ${i + 1} n'a pas d'énoncé.`);
      }
      const options = Array.isArray(q.options) ? q.options : [];
      if (q.type === "qcm" && options.length < 2) {
        throw new Error(
          `La question ${i + 1} est un QCM : elle doit comporter au moins deux propositions.`,
        );
      }
    });
  }
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
  // Le CEF vient de la fiche du stagiaire : il nomme le document remis, et
  // c'est le seul identifiant qui distingue deux homonymes.
  const { data, error } = await supabase
    .from("passations_controle")
    .select(
      "id, controle_id, nom_complet, email, note, responses, submitted_at, publie_le, stagiaires(cef)",
    )
    .eq("controle_id", controleId)
    .order("submitted_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => {
    const { stagiaires, ...reste } = p as typeof p & {
      stagiaires: { cef: string | null } | null;
    };
    return { ...reste, cef: stagiaires?.cef ?? null } as Passation;
  });
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

  // Un test porte sur des séances choisies une à une : on les propose toutes,
  // faites ou à venir, et c'est le formateur qui coche.
  const retenues =
    type === "CC" ? toutes.filter((s) => s.statut === "fait") : toutes;

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

/**
 * Publie — ou retire — le résultat d'une copie (PRD §4.7).
 *
 * Le stagiaire ne voit rien tant que ce geste n'a pas été fait : ni note, ni
 * corrigé. Même principe que le partage de la grille de correction d'un TP,
 * et même réserve — refermer empêche un accès futur, ça n'efface pas ce qui a
 * déjà été lu. L'écran doit le dire, l'action ne le prétend pas.
 *
 * La date sert de trace autant que d'interrupteur : le cahier du formateur
 * impose de restituer les notes d'un CC au plus tard à la deuxième séance
 * suivante, et savoir quand un résultat est parti est ce qui permet de le
 * vérifier.
 */
/**
 * Le dossier d'un contrôle : ses résultats publiés et sa feuille d'émargement.
 *
 * Assemblé ici et non dans l'écran : les trois écrans qui s'en servent — la
 * liste des copies, la correction, le lot — n'ont pas les mêmes données sous
 * la main, et recopier l'assemblage aurait garanti qu'ils divergent.
 *
 * Les lectures communes — le contrôle, son module, son groupe, l'horaire de la
 * séance, les réglages du formateur — sont faites une fois pour toutes les
 * copies. Les répéter par copie, c'était six requêtes par stagiaire pour un
 * groupe entier.
 *
 * Seules les copies publiées en sortent. Le document porte la mention
 * « publié le » : éditer un résultat que le stagiaire n'a pas encore reçu
 * ferait signer une pièce qui n'existe pas.
 */
/** Ce qu'il faut d'un contrôle pour l'annoncer — enregistré ou non. */
type ControlePourEntete = {
  /** Absent pour un brouillon pas encore enregistré. */
  id?: string | null;
  groupe_id: string;
  module_id: string;
  titre: string | null;
  duree_heures: number | string | null;
  type: string;
  type_efm: string | null;
  format: string;
  date_prevue: string | null;
  date_administration: string | null;
  created_at?: string | null;
};

export type EnteteControle = {
  titre: string;
  nature: string;
  /** Le code qui nomme les fichiers : CC1, CC2, EFML, EFMR. */
  codeEpreuve: string;
  codeModule: string | null;
  dateFichier: string | null;
  identification: Identification;
  groupe: string | null;
};

/**
 * L'en-tête d'une pièce de contrôle : titre, nature, code d'épreuve et
 * cartouche d'identification (PRD §4.7).
 *
 * Partagé par le dossier d'épreuve et par le sujet qu'on imprime pendant la
 * préparation — y compris avant tout enregistrement. Deux constructions
 * distinctes auraient fini par annoncer la même épreuve de deux façons.
 */
async function enteteControle(
  controle: ControlePourEntete,
): Promise<EnteteControle> {
  const supabase = await createClient();
  const dateEpreuve =
    controle.date_administration ?? controle.date_prevue ?? null;

  const [moduleRes, groupeRes, freres, etablissement, debut] =
    await Promise.all([
      supabase
        .from("modules")
        .select("nom, competences(code_operationnel)")
        .eq("id", controle.module_id)
        .maybeSingle(),
      supabase
        .from("groupes")
        .select("nom, annee, specialites(nom)")
        .eq("id", controle.groupe_id)
        .maybeSingle(),
      supabase
        .from("controles")
        .select("id, type, date_prevue, date_administration, created_at")
        .eq("groupe_id", controle.groupe_id)
        .eq("module_id", controle.module_id)
        .eq("type", controle.type),
      getEtablissement(),
      getDebutEpreuve(controle.groupe_id, dateEpreuve),
    ]);

  // Le rang du contrôle parmi ceux du même type : CC1, CC2… Il n'est stocké
  // nulle part, sans quoi il faudrait renuméroter à chaque contrôle inséré
  // entre deux autres. Un brouillon non enregistré prend le rang suivant.
  const quand = (c: {
    date_prevue: string | null;
    date_administration: string | null;
    created_at: string;
  }) => c.date_administration ?? c.date_prevue ?? c.created_at;
  const tries = (freres.data ?? [])
    .slice()
    .sort((a, b) => quand(a).localeCompare(quand(b)));
  const rang = controle.id
    ? tries.findIndex((c) => c.id === controle.id) + 1
    : tries.length + 1;

  const duree = Number(controle.duree_heures ?? 0);
  const codeModule = moduleRes.data?.competences?.code_operationnel ?? null;
  const efm = controle.type === "EFM";
  const test = controle.type === "TEST";
  const titre = controle.titre?.trim() || "Contrôle sans intitulé";
  const nature = efm
    ? "Épreuve de fin de module"
    : test
      ? "Contrôle de test"
      : "Contrôle continu";
  // Le rang se compte parmi les contrôles du même type : un test ne décale pas
  // la numérotation des CC, qui est réglementaire.
  const codeEpreuve = efm
    ? controle.type_efm === "regional"
      ? "EFMR"
      : "EFML"
    : `${test ? "TEST" : "CC"}${rang > 0 ? rang : ""}`;

  const FORMES: Record<string, string> = {
    theorique: "Théorique",
    pratique: "Pratique",
    mixte: "Mixte",
  };

  const identification: Identification = {
    etablissement: etablissement.nom,
    forme: FORMES[controle.format] ?? null,
    filiere: [
      groupeRes.data?.specialites?.nom,
      groupeRes.data?.annee ? `${groupeRes.data.annee}e année` : null,
    ]
      .filter(Boolean)
      .join(" · "),
    groupe: groupeRes.data?.nom ?? null,
    anneeScolaire: etablissement.anneeScolaire,
    module: [codeModule, moduleRes.data?.nom].filter(Boolean).join(" — "),
    formateur: etablissement.nomFormateur,
    matricule: etablissement.matricule,
    dateEpreuve: dateEpreuve ? formatDateJour(dateEpreuve) : null,
    horaire: debut
      ? [
          `de ${formatHeure(debut)} à ${formatHeure(finEpreuve(debut, duree))}`,
          duree > 0 ? `durée ${dureeEnTexte(duree)}` : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : duree > 0
        ? `durée ${dureeEnTexte(duree)}`
        : null,
  };

  return {
    titre,
    nature,
    codeEpreuve,
    codeModule,
    dateFichier: dateEpreuve,
    identification,
    groupe: groupeRes.data?.nom ?? null,
  };
}

/**
 * L'en-tête d'un contrôle en cours de préparation, enregistré ou non.
 *
 * Le sujet s'imprime pendant qu'on le prépare : exiger un enregistrement
 * préalable aurait fait du bouton « Télécharger » un piège sur un brouillon.
 */
export async function getEnteteBrouillon(input: {
  controleId: string | null;
  groupeId: string;
  moduleId: string;
  titre: string;
  type: TypeControle;
  typeEfm: TypeEfm | null;
  format: FormatControle;
  dureeHeures: number;
  datePrevue: string | null;
}): Promise<EnteteControle> {
  return enteteControle({
    id: input.controleId,
    groupe_id: input.groupeId,
    module_id: input.moduleId,
    titre: input.titre,
    duree_heures: input.dureeHeures,
    type: input.type,
    type_efm: input.typeEfm,
    format: input.format,
    date_prevue: input.datePrevue,
    date_administration: null,
  });
}

export type DossierControle = {
  titre: string;
  nature: string;
  /** Le code qui nomme les fichiers : CC1, CC2, EFML, EFMR. */
  codeEpreuve: string;
  codeModule: string | null;
  dateFichier: string | null;
  /** Le cartouche, commun à toutes les pièces du dossier. */
  identification: Identification;
  resultats: ResultatControle[];
  /** Les stagiaires du groupe, dans l'ordre où ils émargent. */
  stagiaires: { cef: string | null; nom: string }[];
};

export async function getDossierControle(
  controleId: string,
): Promise<DossierControle | null> {
  const supabase = await createClient();

  // Les colonnes sont écrites en toutes lettres plutôt que reprises de
  // `COLONNES_CONTROLE` : une chaîne partagée est opaque au typage de
  // PostgREST, qui rend alors un type d'erreur et impose un cast — soit
  // exactement la dette que le backlog recense en point de vigilance.
  const { data: controle, error } = await supabase
    .from("controles")
    .select(
      "id, groupe_id, module_id, titre, duree_heures, type, type_efm, format, date_prevue, date_administration, created_at",
    )
    .eq("id", controleId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!controle) return null;

  const [copiesRes, stagiairesRes, tete] = await Promise.all([
    supabase
      .from("passations_controle")
      .select(
        "id, nom_complet, note, responses, publie_le, submitted_at, stagiaires(cef, cne)",
      )
      .eq("controle_id", controleId)
      .order("nom_complet"),
    supabase
      .from("stagiaires")
      .select("nom, prenom, cef")
      .eq("groupe_id", controle.groupe_id)
      .order("nom"),
    enteteControle(controle),
  ]);
  const { titre, nature, codeEpreuve, codeModule, identification } = tete;
  const dateEpreuve = tete.dateFichier;
  const efm = controle.type === "EFM";

  const resultats: ResultatControle[] = (copiesRes.data ?? [])
    .filter((c) => c.publie_le)
    .map((c) => ({
      titre,
      stagiaire: c.nom_complet,
      nature,
      datePublication: formatDate(c.publie_le!),
      note: Number(c.note) || 0,
      total: efm ? 40 : 20,
      reference: c.id,
      codeEpreuve,
      codeModule,
      cef: c.stagiaires?.cef ?? null,
      // À défaut de date programmée, celle de la remise : pour un contrôle
      // passé dans l'application, c'est le jour de l'épreuve.
      dateFichier: dateEpreuve ?? c.submitted_at?.slice(0, 10) ?? null,
      identification: {
        ...identification,
        cef: c.stagiaires?.cef ?? null,
        cne: c.stagiaires?.cne ?? null,
        dateEpreuve:
          identification.dateEpreuve ??
          (c.submitted_at ? formatDate(c.submitted_at) : null),
      },
      lignes: ((c.responses ?? []) as unknown as PassationDetail[]).map(
        (d) => ({
          enonce: d.enonce,
          bareme: Number(d.bareme ?? 0),
          points: Number(d.points ?? 0),
          reponse: d.reponse,
          corrige: d.corrige,
          commentaire: d.commentaire,
        }),
      ),
    }));

  return {
    titre,
    nature,
    codeEpreuve,
    codeModule,
    dateFichier: dateEpreuve,
    identification,
    resultats,
    stagiaires: (stagiairesRes.data ?? []).map((s) => ({
      cef: s.cef,
      nom: `${s.nom} ${s.prenom}`.trim(),
    })),
  };
}

/**
 * Le sujet vierge d'un contrôle, tel qu'il part au visa (PRD §4.7).
 *
 * Il ne dépend d'aucune copie : le chef de pôle le vise avant l'épreuve,
 * quand rien n'a encore été composé. Il réutilise le cartouche du dossier,
 * pour que le sujet visé et les résultats qui en sortiront s'annoncent de la
 * même façon.
 */
export type SujetControle = {
  titre: string;
  nature: string;
  identification: Identification;
  consignes: string | null;
  questions: {
    type: string;
    enonce: string;
    donnees: string | null;
    bareme: number;
    options: { texte: string }[];
  }[];
  total: number;
  codeEpreuve: string;
  codeModule: string | null;
  dateFichier: string | null;
  groupe: string | null;
};

export async function getSujetControle(
  controleId: string,
): Promise<SujetControle | null> {
  const [dossier, detail] = await Promise.all([
    getDossierControle(controleId),
    getControle(controleId),
  ]);
  if (!dossier || !detail) return null;

  const questions = detail.questions.map((q) => ({
    type: q.type,
    enonce: q.enonce ?? "",
    donnees: q.donnees ?? null,
    bareme: Number(q.bareme) || 0,
    options: (q.options ?? []).map((o) => ({ texte: o.texte })),
  }));

  return {
    titre: dossier.titre,
    nature: dossier.nature,
    identification: dossier.identification,
    consignes: detail.consignes,
    questions,
    total: questions.reduce((t, q) => t + q.bareme, 0),
    codeEpreuve: dossier.codeEpreuve,
    codeModule: dossier.codeModule,
    dateFichier: dossier.dateFichier,
    groupe: dossier.identification.groupe ?? null,
  };
}

/**
 * Le résultat à signer d'une copie, tiré du dossier de son contrôle.
 *
 * Rend `null` si le résultat n'est pas publié.
 */
export async function getResultatASigner(
  passationId: string,
): Promise<ResultatControle | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("passations_controle")
    .select("controle_id")
    .eq("id", passationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const dossier = await getDossierControle(data.controle_id);
  return dossier?.resultats.find((r) => r.reference === passationId) ?? null;
}

/**
 * L'heure à laquelle l'épreuve commence, lue dans l'emploi du temps.
 *
 * Elle ne se ressaisit pas : le contrôle est programmé un jour donné, et ce
 * jour-là le groupe a un créneau — c'est celui-là. Demander l'heure au
 * formateur aurait créé une seconde vérité, qui aurait fini par contredire la
 * première. L'heure de fin ne se stocke pas davantage : c'est le début plus la
 * durée du contrôle, déjà connue.
 *
 * Rend `null` quand aucune séance ne tombe ce jour-là — un contrôle programmé
 * hors créneau, ou une date encore vide. Le document dit alors la date sans
 * l'horaire plutôt que d'en inventer un.
 */
export async function getDebutEpreuve(
  groupeId: string,
  date: string | null,
): Promise<string | null> {
  if (!date) return null;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("seances")
    .select("heure_debut, seance_groupes!inner(groupe_id)")
    .eq("seance_groupes.groupe_id", groupeId)
    .eq("date", date)
    .order("heure_debut", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.heure_debut ?? null;
}

export async function publierResultat(
  passationId: string,
  publier: boolean,
): Promise<{ publieLe: string | null }> {
  const supabase = await createClient();
  const publieLe = publier ? new Date().toISOString() : null;

  const { error } = await supabase
    .from("passations_controle")
    .update({ publie_le: publieLe })
    .eq("id", passationId);

  if (error) throw new Error(error.message);
  return { publieLe };
}
