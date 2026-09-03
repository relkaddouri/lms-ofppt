"use server";

import { createClient, getUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { dateLocale } from "@/lib/format";
import { getAnneeCourante, getPortee } from "@/app/actions/annees";
import {
  construireSemaines,
  construireBilan,
  PLAFONDS_PAR_DEFAUT,
  CIBLE_PAR_DEFAUT,
  type BilanHeures,
  type Rythme,
} from "@/lib/heures-formateur";

/** Lundi de la semaine contenant la date donnée. */
function lundiDe(d: Date): string {
  const j = new Date(d);
  j.setDate(j.getDate() - ((j.getDay() + 6) % 7));
  return dateLocale(j);
}

/**
 * Année de formation : elle commence en septembre, pas en janvier.
 * Une année civile couperait un module en deux.
 */
function anneeFormation(reference: Date): { debut: string; fin: string } {
  const an = reference.getUTCFullYear();
  const debutAn = reference.getUTCMonth() >= 8 ? an : an - 1;
  return { debut: `${debutAn}-09-01`, fin: `${debutAn + 1}-08-31` };
}

export async function getBilanHeures(reference?: string): Promise<BilanHeures> {
  const supabase = await createClient();
  const user = await getUser();

  // PRD §4.15 : le bilan porte sur l'année sélectionnée, et ses bornes sont
  // celles de cette année — pas celles déduites de la date du jour. Consulter
  // 2025/2026 en septembre 2026 doit montrer 2025/2026, pas la fenêtre en
  // cours. La déduction reste le repli, pour un compte sans année déclarée.
  const portee = await getPortee();
  const annee = await getAnneeCourante();
  const maintenant = reference ? new Date(`${reference}T12:00:00Z`) : new Date();
  const { debut, fin } = annee
    ? { debut: annee.dateDebut, fin: annee.dateFin }
    : anneeFormation(maintenant);

  const [seancesRes, rythmesRes, parametres] = await Promise.all([
    // Seules les séances faites comptent : une séance planifiée n'a été
    // dispensée par personne.
    supabase
      .from("seances")
      .select(
        "date, heure_debut, heure_fin, duree_realisee, duree_prevue, seance_groupes!inner(groupe_id)",
      )
      .in("seance_groupes.groupe_id", portee.groupeIds)
      .eq("statut", "fait")
      .not("date", "is", null)
      .gte("date", debut)
      .lte("date", fin),
    supabase
      .from("rythmes_hebdomadaires")
      .select("date_debut, date_fin, heures_cible")
      .eq("annee_scolaire_id", portee.anneeId ?? "")
      .order("date_debut"),
    getParametresFormateur(),
  ]);

  if (seancesRes.error) throw new Error(seancesRes.error.message);
  if (rythmesRes.error) throw new Error(rythmesRes.error.message);

  const parLundi = new Map<string, number>();
  for (const s of seancesRes.data ?? []) {
    if (!s.date) continue;
    const cle = lundiDe(new Date(`${s.date}T12:00:00Z`));
    const heures = Number(s.duree_realisee ?? s.duree_prevue ?? 0);
    parLundi.set(cle, (parLundi.get(cle) ?? 0) + heures);
  }

  const rythmes = (rythmesRes.data ?? []) as unknown as Rythme[];
  const semaines = construireSemaines(
    parLundi,
    rythmes,
    parametres.heures_hebdomadaires,
  );

  // Le suivi n'a de sens que pour le formateur connecté ; sans session, on
  // renvoie un bilan vide plutôt qu'un cumul d'un autre.
  const plafonds = {
    heuresAnnuelles: parametres.heures_annuelles,
    heuresHebdomadaires: parametres.heures_hebdomadaires,
    heuresSupActives: parametres.heures_sup_actives,
    plafondSupMensuel: parametres.plafond_sup_mensuel,
    plafondSupAnnuel: parametres.plafond_sup_annuel,
  };

  // Le suivi n'a de sens que pour le formateur connecté ; sans session, on
  // renvoie un bilan vide plutôt qu'un cumul d'un autre.
  return construireBilan(
    user ? semaines : [],
    lundiDe(maintenant),
    maintenant.toISOString().slice(0, 7),
    plafonds,
  );
}

export async function setRythme(
  dateDebut: string,
  dateFin: string,
  heuresCible: number,
) {
  if (dateDebut > dateFin) {
    throw new Error("La période se termine avant de commencer.");
  }
  if (!(heuresCible > 0 && heuresCible <= 40)) {
    throw new Error("La cible hebdomadaire doit être comprise entre 1 et 40 heures.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("rythmes_hebdomadaires").insert({
    date_debut: dateDebut,
    date_fin: dateFin,
    heures_cible: heuresCible,
  });
  if (error) throw new Error(error.message);
}

export type ParametresFormateur = {
  heures_annuelles: number;
  heures_hebdomadaires: number;
  heures_sup_actives: boolean;
  plafond_sup_mensuel: number;
  plafond_sup_annuel: number;
};

export async function getParametresFormateur(): Promise<ParametresFormateur> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("parametres_formateur")
    .select(
      "heures_annuelles, heures_hebdomadaires, heures_sup_actives, plafond_sup_mensuel, plafond_sup_annuel",
    )
    .maybeSingle();

  if (error) throw new Error(error.message);

  // Aucune ligne : le formateur n'a rien saisi, on part des valeurs du PRD.
  return {
    heures_annuelles: Number(data?.heures_annuelles ?? PLAFONDS_PAR_DEFAUT.annuel),
    heures_hebdomadaires: Number(data?.heures_hebdomadaires ?? CIBLE_PAR_DEFAUT),
    heures_sup_actives: data?.heures_sup_actives ?? false,
    plafond_sup_mensuel: Number(
      data?.plafond_sup_mensuel ?? PLAFONDS_PAR_DEFAUT.supMensuel,
    ),
    plafond_sup_annuel: Number(
      data?.plafond_sup_annuel ?? PLAFONDS_PAR_DEFAUT.supAnnuel,
    ),
  };
}

export async function saveParametresFormateur(input: ParametresFormateur) {
  if (!(input.heures_annuelles > 0 && input.heures_annuelles <= 2000)) {
    throw new Error("Le volume annuel doit être compris entre 1 et 2000 heures.");
  }
  if (!(input.heures_hebdomadaires > 0 && input.heures_hebdomadaires <= 60)) {
    throw new Error("La cible hebdomadaire doit être comprise entre 1 et 60 heures.");
  }
  if (input.heures_sup_actives) {
    if (input.plafond_sup_mensuel < 0 || input.plafond_sup_mensuel > 200) {
      throw new Error("Le plafond mensuel doit être compris entre 0 et 200 heures.");
    }
    if (input.plafond_sup_annuel < 0 || input.plafond_sup_annuel > 1000) {
      throw new Error("Le plafond annuel doit être compris entre 0 et 1000 heures.");
    }
    if (input.plafond_sup_annuel < input.plafond_sup_mensuel) {
      throw new Error(
        "Le plafond annuel ne peut pas être inférieur au plafond mensuel.",
      );
    }
  }

  const user = await getUser();
  if (!user) throw new Error("Authentification requise.");

  const supabase = await createClient();
  const { error } = await supabase.from("parametres_formateur").upsert(
    {
      formateur_id: user.id,
      heures_annuelles: input.heures_annuelles,
      heures_hebdomadaires: input.heures_hebdomadaires,
      heures_sup_actives: input.heures_sup_actives,
      plafond_sup_mensuel: input.plafond_sup_mensuel,
      plafond_sup_annuel: input.plafond_sup_annuel,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "formateur_id" },
  );
  if (error) throw new Error(error.message);

  revalidatePath("/parametres");
  revalidatePath("/calendrier");
}
