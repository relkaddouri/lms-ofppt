"use server";

import { createClient } from "@/lib/supabase/server";
import {
  BUCKET_SURVEILLANCE,
  cheminCapture,
  TYPES_EVENEMENT,
  type EvenementSurveillance,
  type TypeEvenement,
} from "@/lib/surveillance";

export type SurveilleListe = {
  stagiaireId: string;
  /** Le compte, qui est aussi le premier segment du chemin de sa capture. */
  userId: string | null;
  nom: string;
  photo: string | null;
  estTest: boolean;
  /**
   * URL signée de sa capture, valable toute l'épreuve.
   *
   * Signée une fois et pour longtemps, délibérément : l'écran rafraîchit
   * l'image en lui accolant un horodatage, ce qui la fait relire au Storage
   * sans redemander de signature. Redemander des URL toutes les vingt-cinq
   * secondes aurait réveillé le serveur deux cent quatre-vingt-huit fois par
   * épreuve, pour rien.
   */
  capture: string | null;
};

export type EtatSurveillanceControle = {
  /** Le contrôle est-il déclaré surveillé ? */
  surveille: boolean;
  stagiaires: SurveilleListe[];
  evenements: EvenementSurveillance[];
};

const estTypeConnu = (v: string): v is TypeEvenement =>
  (TYPES_EVENEMENT as readonly string[]).includes(v);

/**
 * De quoi peupler la mosaïque, en une seule fois.
 *
 * Tout ce qui suit arrive ensuite par Realtime et par les images elles-mêmes :
 * cette lecture ne se refait pas pendant l'épreuve. C'est la condition pour
 * qu'une surveillance de deux heures ne coûte qu'un seul passage serveur.
 */
export async function getSurveillance(
  controleId: string,
): Promise<EtatSurveillanceControle> {
  const supabase = await createClient();

  const { data: controle, error: errC } = await supabase
    .from("controles")
    .select("groupe_id, surveille")
    .eq("id", controleId)
    .maybeSingle();
  if (errC) throw new Error(errC.message);
  if (!controle?.groupe_id) {
    return { surveille: false, stagiaires: [], evenements: [] };
  }

  const [rosterRes, evenementsRes] = await Promise.all([
    supabase
      .from("stagiaires")
      .select("id, nom, prenom, photo, user_id, est_test")
      .eq("groupe_id", controle.groupe_id)
      .order("nom")
      .limit(60),
    supabase
      .from("surveillance_evenements")
      .select("id, stagiaire_id, type, cree_le")
      .eq("controle_id", controleId)
      .order("cree_le", { ascending: false })
      .limit(500),
  ]);
  if (rosterRes.error) throw new Error(rosterRes.error.message);
  if (evenementsRes.error) throw new Error(evenementsRes.error.message);

  const roster = rosterRes.data ?? [];

  // Une seule demande de signature pour tout le groupe. `createSignedUrls`
  // rend une entrée par chemin, y compris pour les captures qui n'existent
  // pas encore — un stagiaire qui n'a pas commencé n'a pas de fichier, et ce
  // n'est pas une erreur.
  const chemins = roster
    .filter((s) => s.user_id)
    .map((s) => cheminCapture(s.user_id as string, controleId));

  const signees = new Map<string, string>();
  if (chemins.length > 0) {
    const { data } = await supabase.storage
      .from(BUCKET_SURVEILLANCE)
      // Quatre heures : plus longue que n'importe quelle épreuve, de sorte
      // qu'aucune signature n'expire sous les yeux du formateur.
      .createSignedUrls(chemins, 4 * 3600);
    for (const entree of data ?? []) {
      if (entree.signedUrl && entree.path) signees.set(entree.path, entree.signedUrl);
    }
  }

  return {
    surveille: controle.surveille,
    stagiaires: roster.map((s) => ({
      stagiaireId: s.id,
      userId: s.user_id,
      nom: `${s.prenom} ${s.nom}`.trim(),
      photo: s.photo,
      estTest: s.est_test,
      capture: s.user_id
        ? (signees.get(cheminCapture(s.user_id, controleId)) ?? null)
        : null,
    })),
    evenements: (evenementsRes.data ?? [])
      .filter((e) => estTypeConnu(e.type))
      .map((e) => ({
        id: e.id,
        stagiaireId: e.stagiaire_id,
        type: e.type as TypeEvenement,
        creeLe: e.cree_le,
      })),
  };
}

/**
 * Efface les captures d'une épreuve, et son journal avec.
 *
 * Une surveillance n'a pas à survivre à l'épreuve qu'elle surveillait : ce
 * sont les écrans de gens, pas des pièces à conserver. Rien n'automatise ce
 * geste — c'est au formateur de dire quand il n'en a plus besoin.
 */
export async function effacerSurveillance(controleId: string): Promise<void> {
  const supabase = await createClient();

  const { data: controle } = await supabase
    .from("controles")
    .select("groupe_id")
    .eq("id", controleId)
    .maybeSingle();

  if (controle?.groupe_id) {
    const { data: roster } = await supabase
      .from("stagiaires")
      .select("user_id")
      .eq("groupe_id", controle.groupe_id)
      .limit(60);

    const chemins = (roster ?? [])
      .filter((s) => s.user_id)
      .map((s) => cheminCapture(s.user_id as string, controleId));

    if (chemins.length > 0) {
      await supabase.storage.from(BUCKET_SURVEILLANCE).remove(chemins);
    }
  }

  const { error } = await supabase
    .from("surveillance_evenements")
    .delete()
    .eq("controle_id", controleId);
  if (error) throw new Error(error.message);
}
