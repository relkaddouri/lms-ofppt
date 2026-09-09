"use server";

import { createClient } from "@/lib/supabase/server";
import { getEtablissement } from "@/app/actions/etablissement";
import { formatDate, formatDateJour } from "@/lib/format";
import { dureeEnTexte, finEpreuve, formatHeure } from "@/lib/creneaux";
import type { Identification, ResultatControle } from "@/lib/resultat";
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

  const dateEpreuve =
    controle.date_administration ?? controle.date_prevue ?? null;

  const [copiesRes, moduleRes, groupeRes, freres, stagiairesRes, etablissement, debut] =
    await Promise.all([
      supabase
        .from("passations_controle")
        .select(
          "id, nom_complet, note, responses, publie_le, submitted_at, stagiaires(cef, cne)",
        )
        .eq("controle_id", controleId)
        .order("nom_complet"),
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
      supabase
        .from("stagiaires")
        .select("nom, prenom, cef")
        .eq("groupe_id", controle.groupe_id)
        .order("nom"),
      getEtablissement(),
      getDebutEpreuve(controle.groupe_id, dateEpreuve),
    ]);

  // Le rang du contrôle parmi ceux du même type : CC1, CC2… Il n'est stocké
  // nulle part, sans quoi il faudrait renuméroter à chaque contrôle inséré
  // entre deux autres.
  const quand = (c: {
    date_prevue: string | null;
    date_administration: string | null;
    created_at: string;
  }) => c.date_administration ?? c.date_prevue ?? c.created_at;
  const rang =
    (freres.data ?? [])
      .slice()
      .sort((a, b) => quand(a).localeCompare(quand(b)))
      .findIndex((c) => c.id === controle.id) + 1;

  const duree = Number(controle.duree_heures ?? 0);
  const codeModule = moduleRes.data?.competences?.code_operationnel ?? null;
  const efm = controle.type === "EFM";
  const titre = controle.titre?.trim() || "Contrôle sans intitulé";
  const nature = efm ? "Épreuve de fin de module" : "Contrôle continu";
  const codeEpreuve = efm
    ? controle.type_efm === "regional"
      ? "EFMR"
      : "EFML"
    : `CC${rang > 0 ? rang : ""}`;

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
      : null,
  };

  // Troisième béquille de la migration 079, isolée comme les deux autres :
  // `cne` n'entrera dans `database.types.ts` qu'après `supabase db push` et
  // une régénération. À retirer ce jour-là.
  type Identifiants = { cef: string | null; cne: string | null } | null;
  const identifiants = (c: { stagiaires: unknown }): Identifiants =>
    c.stagiaires as Identifiants;

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
      cef: identifiants(c)?.cef ?? null,
      // À défaut de date programmée, celle de la remise : pour un contrôle
      // passé dans l'application, c'est le jour de l'épreuve.
      dateFichier: dateEpreuve ?? c.submitted_at?.slice(0, 10) ?? null,
      identification: {
        ...identification,
        cef: identifiants(c)?.cef ?? null,
        cne: identifiants(c)?.cne ?? null,
        dateEpreuve:
          identification.dateEpreuve ??
          (c.submitted_at ? formatDate(c.submitted_at) : null),
      },
      lignes: ((c.responses ?? []) as unknown as PassationDetail[]).map((d) => ({
        enonce: d.enonce,
        bareme: Number(d.bareme ?? 0),
        points: Number(d.points ?? 0),
        reponse: d.reponse,
        corrige: d.corrige,
        commentaire: d.commentaire,
      })),
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
