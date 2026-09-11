"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Le stagiaire de la journée (PRD §4.5).
 *
 * À la fin d'une séance, le formateur note la participation de chacun sur 10.
 * La meilleure note désigne le stagiaire du jour ; le groupe l'apprend en
 * ouvrant l'application, et le félicite dans le fil.
 *
 * Le départage et la série sont décidés par `designer_stagiaire_du_jour`, en
 * base et d'un seul tenant. Les faire ici exposerait à deux clics rapprochés
 * qui désigneraient deux gagnants pour la même séance.
 */

export type StagiaireANoter = {
  id: string;
  nom: string;
  prenom: string;
  photo: string | null;
  /** `false` quand l'absence est pointée : un absent n'est pas distingué. */
  present: boolean;
  /** Note déjà saisie, pour reprendre une notation interrompue. */
  note: number | null;
};

/** Les stagiaires d'une séance, avec leur présence et leur note éventuelle. */
export async function getStagiairesANoter(
  seanceId: string,
): Promise<StagiaireANoter[]> {
  const supabase = await createClient();

  const { data: lien, error: errLien } = await supabase
    .from("seance_groupes")
    .select("groupe_id")
    .eq("seance_id", seanceId)
    .limit(1)
    .maybeSingle();
  if (errLien) throw new Error(errLien.message);
  if (!lien) return [];

  const [stagiairesRes, presencesRes, notesRes] = await Promise.all([
    supabase
      .from("stagiaires")
      .select("id, nom, prenom, photo")
      .eq("groupe_id", lien.groupe_id)
      .order("nom"),
    supabase
      .from("presences")
      .select("stagiaire_id, present")
      .eq("seance_id", seanceId),
    supabase
      .from("notations_seance")
      .select("stagiaire_id, note")
      .eq("seance_id", seanceId),
  ]);
  if (stagiairesRes.error) throw new Error(stagiairesRes.error.message);

  // Une présence non pointée vaut présent : le formateur qui n'a rien coché
  // n'a pas déclaré d'absence, il n'a pas fait l'appel.
  const presences = new Map(
    (presencesRes.data ?? []).map((p) => [p.stagiaire_id, p.present]),
  );
  const notes = new Map(
    (notesRes.data ?? []).map((n) => [n.stagiaire_id, Number(n.note)]),
  );

  return (stagiairesRes.data ?? []).map((s) => ({
    id: s.id,
    nom: s.nom,
    prenom: s.prenom,
    photo: s.photo,
    present: presences.get(s.id) ?? true,
    note: notes.get(s.id) ?? null,
  }));
}

/**
 * Enregistre les notes, désigne le gagnant, publie l'annonce.
 *
 * Les trois gestes sont un seul geste du point de vue du formateur : il clôt
 * sa séance. Les séparer en trois actions l'exposerait à une clôture à
 * moitié faite, dont rien à l'écran ne dirait où elle s'est arrêtée.
 *
 * L'annonce est créée à la désignation et non à la fermeture de la modale par
 * un stagiaire : seize fermetures donneraient seize annonces.
 */
export async function cloturerSeance(
  seanceId: string,
  notes: { stagiaireId: string; note: number }[],
): Promise<{ gagnant: string; serie: number } | null> {
  const supabase = await createClient();

  if (notes.length > 0) {
    const { error } = await supabase.from("notations_seance").upsert(
      notes.map((n) => ({
        seance_id: seanceId,
        stagiaire_id: n.stagiaireId,
        note: n.note,
      })),
      { onConflict: "seance_id,stagiaire_id" },
    );
    if (error) throw new Error(error.message);
  }

  const { data: distinctionId, error: errDesignation } = await supabase.rpc(
    "designer_stagiaire_du_jour",
    { p_seance_id: seanceId },
  );
  if (errDesignation) throw new Error(errDesignation.message);
  if (!distinctionId) return null;

  const { data: distinction, error: errLecture } = await supabase
    .from("distinctions_jour")
    .select("id, groupe_id, serie, annonce_id, stagiaires(nom, prenom)")
    .eq("id", distinctionId)
    .maybeSingle();
  if (errLecture) throw new Error(errLecture.message);
  if (!distinction) return null;

  const nom = `${distinction.stagiaires?.prenom ?? ""} ${
    distinction.stagiaires?.nom ?? ""
  }`.trim();

  // L'annonce n'est créée qu'une fois : recliquer sur « Fait » ne republie
  // pas les félicitations.
  if (!distinction.annonce_id) {
    const { data: annonce, error: errAnnonce } = await supabase
      .from("annonces")
      .insert({
        groupe_id: distinction.groupe_id,
        titre: `${nom}, stagiaire de la journée`,
        contenu:
          distinction.serie > 1
            ? `${nom} est distingué pour la participation de la journée — et c'est le ${distinction.serie}ᵉ jour d'affilée. Félicitez-le en commentaire.`
            : `${nom} est distingué pour la participation de la journée. Félicitez-le en commentaire.`,
        date: new Date().toISOString().slice(0, 10),
      })
      .select("id")
      .maybeSingle();

    // Une annonce ratée ne doit pas faire échouer la clôture : la séance est
    // close, le gagnant est désigné, et la modale de félicitations ne dépend
    // pas de l'annonce.
    if (!errAnnonce && annonce) {
      await supabase
        .from("distinctions_jour")
        .update({ annonce_id: annonce.id })
        .eq("id", distinction.id);
    }
  }

  revalidatePath("/groupes", "layout");
  revalidatePath("/espace-stagiaire", "layout");
  return { gagnant: nom, serie: distinction.serie };
}

export type DistinctionAFeter = {
  id: string;
  nom: string;
  prenom: string;
  photo: string | null;
  serie: number;
  date: string;
  /** Vrai quand c'est le stagiaire qui regarde qui est distingué. */
  cestMoi: boolean;
};

/**
 * La distinction que le stagiaire n'a pas encore vue.
 *
 * Rend `null` s'il n'y en a pas, ou s'il l'a déjà fêtée. La modale s'ouvre
 * une fois par personne : la rouvrir à chaque navigation transformerait une
 * célébration en gêne.
 */
export async function getDistinctionAFeter(): Promise<DistinctionAFeter | null> {
  const supabase = await createClient();

  const { data: utilisateur } = await supabase.auth.getUser();
  if (!utilisateur.user) return null;

  const { data: moi } = await supabase
    .from("stagiaires")
    .select("id, groupe_id")
    .eq("user_id", utilisateur.user.id)
    .maybeSingle();
  // `groupe_id` est nullable en base : un stagiaire sans groupe n'a pas de
  // distinction à fêter.
  if (!moi?.groupe_id) return null;

  const { data, error } = await supabase
    .from("distinctions_jour")
    .select("id, stagiaire_id, serie, date, stagiaires(nom, prenom, photo)")
    .eq("groupe_id", moi.groupe_id)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;

  const { data: vue } = await supabase
    .from("distinctions_vues")
    .select("distinction_id")
    .eq("distinction_id", data.id)
    .maybeSingle();
  if (vue) return null;

  return {
    id: data.id,
    nom: data.stagiaires?.nom ?? "",
    prenom: data.stagiaires?.prenom ?? "",
    photo: data.stagiaires?.photo ?? null,
    serie: data.serie,
    date: data.date,
    cestMoi: data.stagiaire_id === moi.id,
  };
}

/** Marque la fête comme vue, pour que la modale ne se rouvre pas. */
export async function marquerDistinctionVue(
  distinctionId: string,
): Promise<void> {
  const supabase = await createClient();
  // `ignoreDuplicates` : deux onglets ouverts fermeraient la modale deux fois.
  const { error } = await supabase
    .from("distinctions_vues")
    .upsert({ distinction_id: distinctionId }, { ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

/**
 * La distinction d'une séance, telle que le formateur peut la revoir.
 *
 * Même forme que ce que reçoit le stagiaire, pour que l'aperçu soit un
 * aperçu et non une approximation. Deux différences, assumées : elle ne
 * regarde pas si elle a déjà été vue — un aperçu se rouvre autant qu'on veut —
 * et `cestMoi` est faux, le formateur n'étant pas celui qu'on distingue.
 */
export async function getDistinctionDeSeance(
  seanceId: string,
): Promise<DistinctionAFeter | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("distinctions_jour")
    .select("id, serie, date, stagiaires(nom, prenom, photo)")
    .eq("seance_id", seanceId)
    .maybeSingle();
  if (error || !data) return null;

  return {
    id: data.id,
    nom: data.stagiaires?.nom ?? "",
    prenom: data.stagiaires?.prenom ?? "",
    photo: data.stagiaires?.photo ?? null,
    serie: data.serie,
    date: data.date,
    cestMoi: false,
  };
}

export type ParticipationSeance = {
  /** Tous les stagiaires du groupe, notés ou non, présents ou non. */
  lignes: {
    id: string;
    nom: string;
    prenom: string;
    photo: string | null;
    present: boolean;
    note: number | null;
  }[];
  /** L'identifiant du distingué, quand la séance a été close. */
  gagnantId: string | null;
  /** Sa série au moment de la désignation, figée. */
  serie: number;
  /** La moyenne des notes saisies — sur les notés seulement. */
  moyenne: number | null;
};

/**
 * Ce que le formateur a donné sur une séance, et qui l'a emporté.
 *
 * La notation se fait dans une modale, un visage à la fois, et disparaît une
 * fois close : rien ne permettait de revenir voir ce qu'on avait mis, ni
 * pourquoi c'est celui-là qui a été couronné. Cet onglet est cette mémoire.
 *
 * Il lit et ne corrige pas. Rouvrir la notation depuis ici serait tentant,
 * mais une note de participation est un jugement porté le jour même : la
 * retoucher une semaine plus tard ne la rendrait pas plus juste, et
 * déplacerait la couronne d'un stagiaire à l'autre après que le groupe l'a
 * fêtée.
 */
export async function getParticipationSeance(
  seanceId: string,
): Promise<ParticipationSeance> {
  const [lignes, distinction] = await Promise.all([
    getStagiairesANoter(seanceId),
    getDistinctionDeSeanceBrute(seanceId),
  ]);

  const notees = lignes
    .map((l) => l.note)
    .filter((n): n is number => n !== null);

  return {
    lignes,
    gagnantId: distinction?.stagiaire_id ?? null,
    serie: distinction?.serie ?? 0,
    moyenne:
      notees.length > 0
        ? Math.round((notees.reduce((a, b) => a + b, 0) / notees.length) * 10) /
          10
        : null,
  };
}

/** La distinction d'une séance, sans mise en forme — usage interne. */
async function getDistinctionDeSeanceBrute(
  seanceId: string,
): Promise<{ stagiaire_id: string; serie: number } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("distinctions_jour")
    .select("stagiaire_id, serie")
    .eq("seance_id", seanceId)
    .maybeSingle();
  return data ?? null;
}
