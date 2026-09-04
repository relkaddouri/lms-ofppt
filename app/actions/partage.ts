"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { SeanceParallele } from "@/lib/partage";

/**
 * Partage du contenu pédagogique entre séances de groupes parallèles (§4.3bis).
 *
 * La fiche de préparation et le support ne sont pas dupliqués : une séance
 * miroir désigne celle qui les porte. Ce qui reste propre à chaque séance —
 * présences, remarques, date, statut — n'est jamais concerné. Les contrôles
 * non plus : c'est une exception explicite du PRD.
 */

/**
 * La séance qui porte le contenu de celle-ci : elle-même, ou sa source.
 *
 * Toutes les lectures et écritures de fiche ou de support passent par ici.
 * Une seule indirection, garantie par la base : un miroir ne peut pas pointer
 * vers un miroir.
 */
export async function sourceContenu(seanceId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("seances")
    .select("contenu_source_id")
    .eq("id", seanceId)
    .maybeSingle();
  return data?.contenu_source_id ?? seanceId;
}

/**
 * Séances d'autres groupes qui couvrent le même contenu au même point du
 * programme — proposées, jamais liées d'office.
 *
 * Le rapprochement se fait sur l'ensemble exact des éléments de contenu
 * assignés (§4.2bis) et sur le module : deux groupes dont la répartition
 * horaire est identique produisent des séances aux mêmes éléments, dans le
 * même ordre.
 *
 * Il n'établit rien de lui-même. Un lien erroné ferait qu'éditer la fiche
 * d'un groupe changerait celle d'un autre, absent de l'écran — un effet de
 * bord sur des données hors de vue se consent, il ne se déduit pas. Et la
 * détection cesse silencieusement de trouver des paires dès que les masses
 * horaires des deux groupes diffèrent, la répartition ne coupant plus aux
 * mêmes endroits.
 */
export async function getSeancesParalleles(
  seanceId: string,
): Promise<SeanceParallele[]> {
  const supabase = await createClient();

  const { data: moi } = await supabase
    .from("seances")
    .select(
      "id, module_id, contenu_source_id, seance_elements_contenu(element_contenu_id), seance_groupes(groupe_id)",
    )
    .eq("id", seanceId)
    .maybeSingle();

  if (!moi) return [];

  const r = moi as unknown as {
    module_id: string;
    contenu_source_id: string | null;
    seance_elements_contenu: { element_contenu_id: string }[];
    seance_groupes: { groupe_id: string }[];
  };

  const mesElements = [...r.seance_elements_contenu.map((e) => e.element_contenu_id)].sort();
  // Sans élément assigné, il n'y a rien sur quoi rapprocher : mieux vaut ne
  // rien proposer que proposer au hasard.
  if (mesElements.length === 0) return [];

  const mesGroupes = new Set(r.seance_groupes.map((g) => g.groupe_id));

  const { data: candidates, error } = await supabase
    .from("seances")
    .select(
      "id, date, heure_debut, heure_fin, objectif_operationnel, contenu_source_id, seance_elements_contenu(element_contenu_id), seance_groupes(groupe_id, groupes(nom))",
    )
    .eq("module_id", r.module_id)
    .neq("id", seanceId);

  if (error) throw new Error(error.message);

  const paralleles: SeanceParallele[] = [];

  for (const ligne of candidates ?? []) {
    const c = ligne as unknown as {
      id: string;
      date: string | null;
      heure_debut: string | null;
      heure_fin: string | null;
      objectif_operationnel: string | null;
      contenu_source_id: string | null;
      seance_elements_contenu: { element_contenu_id: string }[];
      seance_groupes: { groupe_id: string; groupes: { nom: string } | null }[];
    };

    const groupes = c.seance_groupes.map((g) => g.groupe_id);
    // Une séance du même groupe n'est pas parallèle : c'est la suite du
    // programme, pas le même point vu par une autre classe.
    if (groupes.some((g) => mesGroupes.has(g))) continue;

    const siens = [...c.seance_elements_contenu.map((e) => e.element_contenu_id)].sort();
    if (siens.length !== mesElements.length) continue;
    if (siens.some((e, i) => e !== mesElements[i])) continue;

    paralleles.push({
      id: c.id,
      groupeNom: c.seance_groupes.map((g) => g.groupes?.nom).filter(Boolean).join(" · ") || "—",
      date: c.date,
      heure_debut: c.heure_debut,
      heure_fin: c.heure_fin,
      objectif: c.objectif_operationnel,
      dejaLiee:
        c.contenu_source_id === seanceId ||
        c.contenu_source_id === r.contenu_source_id ||
        c.id === r.contenu_source_id,
    });
  }

  // Tri par date : quand un objectif s'étale sur plusieurs créneaux, toutes
  // ses séances portent le même ensemble d'éléments et se ressemblent — c'est
  // la date qui permet au formateur de reconnaître la bonne.
  return paralleles.sort(
    (a, b) =>
      (a.date ?? "9999").localeCompare(b.date ?? "9999") ||
      (a.heure_debut ?? "").localeCompare(b.heure_debut ?? "") ||
      a.groupeNom.localeCompare(b.groupeNom, "fr"),
  );
}

/**
 * Lie une séance à celle qui porte le contenu.
 *
 * La séance liée perd sa propre fiche et son propre support s'ils existaient :
 * garder deux contenus dont un seul s'affiche laisserait croire à une
 * sauvegarde qui n'a plus lieu.
 */
export async function partagerContenu(
  seanceId: string,
  sourceId: string,
): Promise<void> {
  const supabase = await createClient();

  // Si la cible est elle-même un miroir, on suit sa source : la base refuse
  // les chaînes, autant résoudre ici plutôt que de renvoyer une erreur.
  const source = await sourceContenu(sourceId);
  if (source === seanceId) {
    throw new Error("Cette séance porte déjà le contenu partagé.");
  }

  const { error: errFiches } = await supabase
    .from("fiches_preparation")
    .delete()
    .eq("seance_id", seanceId);
  if (errFiches) throw new Error(errFiches.message);

  const { error: errSupports } = await supabase
    .from("supports_seance")
    .delete()
    .eq("seance_id", seanceId);
  if (errSupports) throw new Error(errSupports.message);

  const { error } = await supabase
    .from("seances")
    .update({ contenu_source_id: source, updated_at: new Date().toISOString() })
    .eq("id", seanceId);
  if (error) throw new Error(error.message);

  revalidatePath("/groupes", "layout");
  revalidatePath("/calendrier");
}

/**
 * Détache une séance du contenu partagé.
 *
 * Elle repart sans fiche ni support plutôt qu'avec une copie : copier
 * ressusciterait exactement la divergence que le partage évite, et le
 * formateur qui détache veut précisément écrire autre chose.
 */
export async function cesserPartage(seanceId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("seances")
    .update({ contenu_source_id: null, updated_at: new Date().toISOString() })
    .eq("id", seanceId);
  if (error) throw new Error(error.message);

  revalidatePath("/groupes", "layout");
  revalidatePath("/calendrier");
}
