"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { BAREME, DOCUMENTS_STAGE, type TypeDocumentStage } from "@/lib/stage";

const BUCKET = "documents-stage";

export type DocumentStage = {
  id: string;
  type: TypeDocumentStage;
  chemin: string;
  nom_fichier: string;
  taille_octets: number | null;
  created_at: string;
};

export type StageStagiaire = {
  stagiaireId: string;
  nom: string;
  prenom: string;
  /** Null tant qu'aucun stage n'a été ouvert pour ce stagiaire. */
  stageId: string | null;
  entreprise: string | null;
  tuteur_nom: string | null;
  tuteur_contact: string | null;
  date_debut: string | null;
  date_fin: string | null;
  date_soutenance: string | null;
  jury: string | null;
  note_rapport_presentation: number | null;
  note_rapport_contenu: number | null;
  note_expose_fond: number | null;
  note_expose_forme: number | null;
  documents: DocumentStage[];
};

/** Les stagiaires du groupe, avec leur stage quand il existe. */
export async function getStagesGroupe(
  groupeId: string,
): Promise<StageStagiaire[]> {
  const supabase = await createClient();

  const { data: stagiaires, error } = await supabase
    .from("stagiaires")
    .select("id, nom, prenom")
    .eq("groupe_id", groupeId)
    .order("nom");
  if (error) throw new Error(error.message);
  if (!stagiaires || stagiaires.length === 0) return [];

  const { data: stages, error: erreurStages } = await supabase
    .from("stages")
    .select(
      "id, stagiaire_id, entreprise, tuteur_nom, tuteur_contact, date_debut, date_fin, date_soutenance, jury, note_rapport_presentation, note_rapport_contenu, note_expose_fond, note_expose_forme",
    )
    .in(
      "stagiaire_id",
      stagiaires.map((s) => s.id),
    );
  if (erreurStages) throw new Error(erreurStages.message);

  const ids = (stages ?? []).map((s) => s.id);
  const { data: documents, error: erreurDocs } = ids.length
    ? await supabase
        .from("documents_stage")
        .select("id, stage_id, type, chemin, nom_fichier, taille_octets, created_at")
        .in("stage_id", ids)
    : { data: [], error: null };
  if (erreurDocs) throw new Error(erreurDocs.message);

  const parStagiaire = new Map((stages ?? []).map((s) => [s.stagiaire_id, s]));

  return stagiaires.map((st) => {
    const stage = parStagiaire.get(st.id);
    return {
      stagiaireId: st.id,
      nom: st.nom,
      prenom: st.prenom,
      stageId: stage?.id ?? null,
      entreprise: stage?.entreprise ?? null,
      tuteur_nom: stage?.tuteur_nom ?? null,
      tuteur_contact: stage?.tuteur_contact ?? null,
      date_debut: stage?.date_debut ?? null,
      date_fin: stage?.date_fin ?? null,
      date_soutenance: stage?.date_soutenance ?? null,
      jury: stage?.jury ?? null,
      note_rapport_presentation: stage?.note_rapport_presentation ?? null,
      note_rapport_contenu: stage?.note_rapport_contenu ?? null,
      note_expose_fond: stage?.note_expose_fond ?? null,
      note_expose_forme: stage?.note_expose_forme ?? null,
      documents: ((documents ?? []) as DocumentStage[] & { stage_id: string }[])
        .filter((d) => (d as unknown as { stage_id: string }).stage_id === stage?.id)
        .map((d) => ({
          id: d.id,
          type: d.type,
          chemin: d.chemin,
          nom_fichier: d.nom_fichier,
          taille_octets: d.taille_octets,
          created_at: d.created_at,
        })),
    };
  });
}

export type MajStage = {
  entreprise?: string | null;
  tuteur_nom?: string | null;
  tuteur_contact?: string | null;
  date_debut?: string | null;
  date_fin?: string | null;
  date_soutenance?: string | null;
  jury?: string | null;
  note_rapport_presentation?: number | null;
  note_rapport_contenu?: number | null;
  note_expose_fond?: number | null;
  note_expose_forme?: number | null;
};

/** Plafond de chaque case, pour revalider côté serveur ce que l'écran borne. */
const PLAFONDS: Record<string, number> = {
  note_rapport_presentation: BAREME.rapport.presentation,
  note_rapport_contenu: BAREME.rapport.contenu,
  note_expose_fond: BAREME.expose.fond,
  note_expose_forme: BAREME.expose.forme,
};

const CHAMPS_STAGE = [
  "entreprise",
  "tuteur_nom",
  "tuteur_contact",
  "date_debut",
  "date_fin",
  "date_soutenance",
  "jury",
  "note_rapport_presentation",
  "note_rapport_contenu",
  "note_expose_fond",
  "note_expose_forme",
] as const;

/**
 * Crée le stage au besoin et applique la modification.
 *
 * Une note reçue du navigateur n'est jamais écrite telle quelle : chaque case
 * est revalidée contre son plafond, et seules les colonnes attendues passent.
 */
export async function majStage(stagiaireId: string, input: MajStage) {
  for (const [champ, plafond] of Object.entries(PLAFONDS)) {
    const valeur = input[champ as keyof MajStage];
    if (valeur === undefined || valeur === null) continue;
    const n = Number(valeur);
    if (!Number.isFinite(n) || n < 0 || n > plafond) {
      throw new Error(`Note hors barème : le maximum est ${plafond}.`);
    }
  }
  if (
    input.date_debut &&
    input.date_fin &&
    input.date_fin < input.date_debut
  ) {
    throw new Error("La fin du stage précède son début.");
  }

  const supabase = await createClient();

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  for (const cle of CHAMPS_STAGE) {
    if (input[cle] !== undefined) update[cle] = input[cle];
  }

  const { error } = await supabase
    .from("stages")
    .upsert(
      { stagiaire_id: stagiaireId, ...update },
      { onConflict: "stagiaire_id" },
    );
  if (error) throw new Error(error.message);

  revalidatePath("/groupes");
}

/**
 * URL signée de courte durée : le bucket est privé, rien n'est servi en clair.
 * Le nom d'origine est réattaché au téléchargement — le chemin de stockage,
 * lui, ne porte que l'identifiant du stage et la nature de la pièce.
 */
export async function urlDocumentStage(
  chemin: string,
  nomFichier: string,
): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(chemin, 60 * 5, { download: nomFichier });
  if (error || !data) throw new Error(error?.message ?? "Lien indisponible.");
  return data.signedUrl;
}

export async function supprimerDocumentStage(id: string) {
  const supabase = await createClient();

  const { data: doc, error: erreurLecture } = await supabase
    .from("documents_stage")
    .select("chemin")
    .eq("id", id)
    .maybeSingle();
  if (erreurLecture) throw new Error(erreurLecture.message);
  if (!doc) throw new Error("Document introuvable.");

  // Le fichier d'abord : une ligne sans fichier est réparable, un fichier
  // orphelin dans le bucket ne se retrouve plus.
  const { error: erreurFichier } = await supabase.storage
    .from(BUCKET)
    .remove([doc.chemin]);
  if (erreurFichier) throw new Error(erreurFichier.message);

  const { error } = await supabase.from("documents_stage").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/groupes");
}

/** Enregistre le dépôt une fois le fichier téléversé par le navigateur. */
export async function enregistrerDocumentStage(input: {
  stageId: string;
  type: TypeDocumentStage;
  chemin: string;
  nomFichier: string;
  tailleOctets: number;
}) {
  if (!DOCUMENTS_STAGE.some((d) => d.type === input.type)) {
    throw new Error("Nature de document inconnue.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("documents_stage").upsert(
    {
      stage_id: input.stageId,
      type: input.type,
      chemin: input.chemin,
      nom_fichier: input.nomFichier,
      taille_octets: input.tailleOctets,
    },
    { onConflict: "stage_id,type" },
  );
  if (error) throw new Error(error.message);

  revalidatePath("/groupes");
}
