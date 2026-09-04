"use server";

import { createClient, getUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getPortee } from "@/app/actions/annees";
import { replanifier } from "@/app/actions/motifs";
import {
  TYPES_INDISPONIBILITE,
  type Indisponibilite,
  type TypeIndisponibilite,
} from "@/lib/indisponibilites";

/** Indisponibilités touchant la période, bornes comprises. */
export async function getIndisponibilites(
  debut: string,
  fin: string,
): Promise<Indisponibilite[]> {
  const supabase = await createClient();

  // Une période chevauche la fenêtre dès qu'elle commence avant sa fin et
  // finit après son début : borner sur la seule date de début raterait les
  // vacances qui ont commencé la semaine d'avant.
  // PRD §4.15 : les fériés et absences appartiennent à une année scolaire.
  // Cette table pend du formateur et d'aucun groupe : elle porte donc le champ
  // et se borne par lui.
  const { anneeId } = await getPortee();

  const { data, error } = await supabase
    .from("indisponibilites")
    .select("id, type, date_debut, date_fin, demi_journee, libelle, motif")
    .eq("annee_scolaire_id", anneeId ?? "")
    .lte("date_debut", fin)
    .gte("date_fin", debut)
    .order("date_debut");

  if (error) throw new Error(error.message);
  return (data ?? []) as Indisponibilite[];
}

/**
 * Toutes les indisponibilités encore à venir, quelle que soit la semaine.
 *
 * Le panneau du calendrier n'affichait que celles de la semaine affichée :
 * un férié déclaré pour décembre disparaissait de l'écran aussitôt saisi, et
 * il fallait retrouver sa semaine pour le corriger. Une liste à part, bornée
 * au futur, rend l'ensemble consultable depuis n'importe quelle semaine.
 */
export async function getIndisponibilitesAVenir(
  depuis: string,
): Promise<Indisponibilite[]> {
  const supabase = await createClient();

  const { anneeId } = await getPortee();

  const { data, error } = await supabase
    .from("indisponibilites")
    .select("id, type, date_debut, date_fin, demi_journee, libelle, motif")
    .eq("annee_scolaire_id", anneeId ?? "")
    .gte("date_fin", depuis)
    .order("date_debut")
    .limit(60);

  if (error) throw new Error(error.message);
  return (data ?? []) as Indisponibilite[];
}

export type NouvelleIndisponibilite = {
  type: TypeIndisponibilite;
  date_debut: string;
  date_fin: string;
  demi_journee: "matin" | "soir" | null;
  libelle: string | null;
  motif: string | null;
};

export async function declarerIndisponibilite(input: NouvelleIndisponibilite) {
  const user = await getUser();
  if (!user) throw new Error("Authentification requise.");

  const { type, date_debut, date_fin, demi_journee } = input;

  if (!TYPES_INDISPONIBILITE.some((t) => t.valeur === type)) {
    throw new Error("Nature d'indisponibilité inconnue.");
  }
  if (!date_debut || !date_fin) {
    throw new Error("Les deux dates sont nécessaires.");
  }
  if (date_fin < date_debut) {
    throw new Error("La date de fin précède la date de début.");
  }
  if (demi_journee && date_debut !== date_fin) {
    throw new Error("Une demi-journée ne peut concerner qu'un seul jour.");
  }
  if (demi_journee && demi_journee !== "matin" && demi_journee !== "soir") {
    throw new Error("Demi-journée inconnue.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("indisponibilites").insert({
    formateur_id: user.id,
    type,
    date_debut,
    date_fin,
    demi_journee,
    libelle: input.libelle?.trim() || null,
    // Un motif n'a de sens que pour une absence.
    motif: type === "absence" ? input.motif?.trim() || null : null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/calendrier");
  return replanifierTousLesGroupes();
}

export async function supprimerIndisponibilite(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("indisponibilites")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/calendrier");
  return replanifierTousLesGroupes();
}

/**
 * Un jour non travaillé vaut pour tout le monde : férié, vacances ou absence
 * du formateur écartent la journée pour chacun de ses groupes. Le recalcul
 * (PRD §4.9) porte donc sur l'année entière, pas sur un groupe.
 *
 * C'est le bug d'origine de la règle : un férié saisi au 18/09 au lieu du
 * 18/11, supprimé après coup, laissait les séances sur leur ancien placement.
 */
async function replanifierTousLesGroupes() {
  const { groupeIds } = await getPortee();
  return replanifier(groupeIds);
}
