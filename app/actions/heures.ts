"use server";

import { createClient, getUser } from "@/lib/supabase/server";
import {
  construireSemaines,
  construireBilan,
  type BilanHeures,
  type Rythme,
} from "@/lib/heures-formateur";

/** Lundi de la semaine contenant la date donnée. */
function lundiDe(d: Date): string {
  const j = new Date(d);
  j.setDate(j.getDate() - ((j.getDay() + 6) % 7));
  return j.toISOString().slice(0, 10);
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

  const maintenant = reference ? new Date(`${reference}T12:00:00Z`) : new Date();
  const { debut, fin } = anneeFormation(maintenant);

  const [seancesRes, rythmesRes] = await Promise.all([
    // Seules les séances faites comptent : une séance planifiée n'a été
    // dispensée par personne.
    supabase
      .from("seances")
      .select("date, heure_debut, heure_fin, duree_realisee, duree_prevue")
      .eq("statut", "fait")
      .not("date", "is", null)
      .gte("date", debut)
      .lte("date", fin),
    supabase
      .from("rythmes_hebdomadaires")
      .select("date_debut, date_fin, heures_cible")
      .order("date_debut"),
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
  const semaines = construireSemaines(parLundi, rythmes);

  // Le suivi n'a de sens que pour le formateur connecté ; sans session, on
  // renvoie un bilan vide plutôt qu'un cumul d'un autre.
  if (!user) {
    return construireBilan([], lundiDe(maintenant), maintenant.toISOString().slice(0, 7));
  }

  return construireBilan(
    semaines,
    lundiDe(maintenant),
    maintenant.toISOString().slice(0, 7),
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
