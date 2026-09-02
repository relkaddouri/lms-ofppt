"use server";

import { createClient, getUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type CreneauMotif = {
  id: string;
  jour_semaine: number;
  heure_debut: string;
  heure_fin: string;
  groupe_id: string;
  groupeNom: string;
};

export type MotifHebdomadaire = {
  id: string;
  libelle: string | null;
  date_debut: string;
  date_fin: string | null;
  /** Le motif en vigueur : celui qui n'a pas encore de date de fin. */
  courant: boolean;
  creneaux: CreneauMotif[];
};


/**
 * Motifs du formateur, du plus récent au plus ancien.
 *
 * Le PRD insiste : un motif n'est pas figé sur l'année. Les précédents restent
 * consultables avec leur période de validité — c'est ce que le classeur
 * papier montre en section I.B.
 */
export async function getMotifs(): Promise<MotifHebdomadaire[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("motifs_hebdomadaires")
    .select(
      "id, libelle, date_debut, date_fin, creneaux_motif(id, jour_semaine, heure_debut, heure_fin, groupe_id, groupes(nom))",
    )
    .order("date_debut", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((m) => {
    const r = m as unknown as {
      id: string;
      libelle: string | null;
      date_debut: string;
      date_fin: string | null;
      creneaux_motif: {
        id: string;
        jour_semaine: number;
        heure_debut: string;
        heure_fin: string;
        groupe_id: string;
        groupes: { nom: string } | null;
      }[];
    };
    return {
      id: r.id,
      libelle: r.libelle,
      date_debut: r.date_debut,
      date_fin: r.date_fin,
      courant: r.date_fin === null,
      creneaux: (r.creneaux_motif ?? [])
        .map((c) => ({
          id: c.id,
          jour_semaine: c.jour_semaine,
          heure_debut: c.heure_debut.slice(0, 5),
          heure_fin: c.heure_fin.slice(0, 5),
          groupe_id: c.groupe_id,
          groupeNom: c.groupes?.nom ?? "Groupe",
        }))
        .sort(
          (a, b) =>
            a.jour_semaine - b.jour_semaine ||
            a.heure_debut.localeCompare(b.heure_debut),
        ),
    };
  });
}

export async function ouvrirMotif(libelle: string, dateDebut: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ouvrir_motif", {
    p_libelle: libelle,
    p_date_debut: dateDebut,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/emploi-du-temps");
  return data as string;
}

export async function ajouterCreneau(input: {
  motifId: string;
  jour: number;
  heureDebut: string;
  heureFin: string;
  groupeId: string;
}) {
  if (input.heureFin <= input.heureDebut) {
    throw new Error("L'heure de fin doit suivre l'heure de début.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("creneaux_motif").insert({
    motif_id: input.motifId,
    jour_semaine: input.jour,
    heure_debut: input.heureDebut,
    heure_fin: input.heureFin,
    groupe_id: input.groupeId,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/emploi-du-temps");
}

export async function supprimerCreneau(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("creneaux_motif").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/emploi-du-temps");
}

export type ResultatGeneration = {
  placees: number;
  restantes: number;
  joursSautes: number;
  derniereDate: string | null;
};

/**
 * Place les séances non datées d'un groupe sur les créneaux du motif courant.
 *
 * Le générateur ne crée pas de séances : la répartition horaire (§4.1) les a
 * déjà produites, sans date, dans l'ordre du référentiel. Il leur donne leur
 * place dans le temps, en sautant ce qui n'est pas travaillé.
 */
export async function genererSeances(
  groupeId: string,
  dateDebut: string,
  semainesMax = 40,
): Promise<ResultatGeneration> {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) throw new Error("Authentification requise.");

  const [motifRes, seancesRes, indispoRes] = await Promise.all([
    supabase
      .from("motifs_hebdomadaires")
      .select("id, date_fin, creneaux_motif(jour_semaine, heure_debut, heure_fin, groupe_id)")
      .lte("date_debut", dateDebut)
      .order("date_debut", { ascending: false })
      .limit(1),
    supabase
      .from("seances")
      .select("id, seance_groupes!inner(groupe_id)")
      .eq("seance_groupes.groupe_id", groupeId)
      .is("date", null)
      .order("created_at"),
    supabase
      .from("indisponibilites")
      .select("date_debut, date_fin, demi_journee"),
  ]);

  if (motifRes.error) throw new Error(motifRes.error.message);
  if (seancesRes.error) throw new Error(seancesRes.error.message);
  if (indispoRes.error) throw new Error(indispoRes.error.message);

  const motif = motifRes.data?.[0];
  if (!motif) {
    throw new Error(
      "Aucun motif hebdomadaire ne couvre cette date. Déclarez-en un d'abord.",
    );
  }

  const creneaux = (motif.creneaux_motif ?? [])
    .filter((c) => c.groupe_id === groupeId)
    .sort(
      (a, b) =>
        a.jour_semaine - b.jour_semaine ||
        a.heure_debut.localeCompare(b.heure_debut),
    );

  if (creneaux.length === 0) {
    throw new Error("Ce motif ne réserve aucun créneau à ce groupe.");
  }

  const aPlacer = seancesRes.data ?? [];
  if (aPlacer.length === 0) {
    return { placees: 0, restantes: 0, joursSautes: 0, derniereDate: null };
  }

  // Un jour est écarté s'il tombe dans une indisponibilité — férié, vacances,
  // absence. Une demi-journée bloque toute la journée : le motif raisonne en
  // créneaux entiers, pas en fractions.
  const bloques = new Set<string>();
  for (const i of indispoRes.data ?? []) {
    const d = new Date(`${i.date_debut}T12:00:00Z`);
    const fin = new Date(`${i.date_fin ?? i.date_debut}T12:00:00Z`);
    while (d <= fin) {
      bloques.add(d.toISOString().slice(0, 10));
      d.setUTCDate(d.getUTCDate() + 1);
    }
  }

  const majs: { id: string; date: string; debut: string; fin: string }[] = [];
  let joursSautes = 0;
  const curseur = new Date(`${dateDebut}T12:00:00Z`);
  const limite = new Date(curseur);
  limite.setUTCDate(limite.getUTCDate() + semainesMax * 7);
  const finMotif = motif.date_fin ? new Date(`${motif.date_fin}T12:00:00Z`) : null;

  let index = 0;
  while (index < aPlacer.length && curseur <= limite) {
    if (finMotif && curseur > finMotif) break;

    const iso = curseur.toISOString().slice(0, 10);
    const isodow = curseur.getUTCDay() === 0 ? 7 : curseur.getUTCDay();

    if (bloques.has(iso)) {
      if (creneaux.some((c) => c.jour_semaine === isodow)) joursSautes += 1;
    } else {
      for (const c of creneaux.filter((x) => x.jour_semaine === isodow)) {
        if (index >= aPlacer.length) break;
        majs.push({
          id: aPlacer[index]!.id,
          date: iso,
          debut: c.heure_debut,
          fin: c.heure_fin,
        });
        index += 1;
      }
    }
    curseur.setUTCDate(curseur.getUTCDate() + 1);
  }

  for (const m of majs) {
    const { error } = await supabase
      .from("seances")
      .update({
        date: m.date,
        heure_debut: m.debut,
        heure_fin: m.fin,
        updated_at: new Date().toISOString(),
      })
      .eq("id", m.id);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/calendrier");
  revalidatePath(`/groupes/${groupeId}/progression`);
  revalidatePath("/emploi-du-temps");

  return {
    placees: majs.length,
    restantes: aPlacer.length - majs.length,
    joursSautes,
    derniereDate: majs.at(-1)?.date ?? null,
  };
}
