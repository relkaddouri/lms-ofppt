"use server";

import { createClient, getUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type Groupe = {
  id: string;
  nom: string;
  /**
   * Première et dernière séance datées du groupe.
   *
   * Ces bornes ne se saisissent plus : elles se déduisent du calendrier
   * réellement généré par le motif hebdomadaire (PRD §4.9). Nulles tant
   * qu'aucune séance n'a de date.
   */
  date_debut: string | null;
  date_fin: string | null;
  annee: number | null;
  /** Nom de la spécialité du groupe, tel qu'affiché sur sa carte. */
  specialite: string | null;
  stagiaires?: { count: number }[];
};

/**
 * Bornes réelles de chaque groupe, lues sur ses séances datées.
 *
 * Une seule requête pour tous les groupes : la faire par groupe multiplierait
 * les allers-retours sur l'écran qui les liste tous.
 */
export async function getPeriodesGroupes(): Promise<
  Map<string, { debut: string | null; fin: string | null }>
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("seance_groupes")
    .select("groupe_id, seances!inner(date)")
    .not("seances.date", "is", null);

  if (error) throw new Error(error.message);

  const bornes = new Map<string, { debut: string | null; fin: string | null }>();
  for (const ligne of data ?? []) {
    const r = ligne as unknown as {
      groupe_id: string;
      seances: { date: string | null } | null;
    };
    const d = r.seances?.date;
    if (!d) continue;
    const courant = bornes.get(r.groupe_id);
    if (!courant) bornes.set(r.groupe_id, { debut: d, fin: d });
    else {
      if (d < courant.debut!) courant.debut = d;
      if (d > courant.fin!) courant.fin = d;
    }
  }
  return bornes;
}

export async function getGroupes(): Promise<Groupe[]> {
  const supabase = await createClient();
  const periodes = await getPeriodesGroupes();
  // Colonnes explicites plutôt que `*` (conventions.md).
  const { data, error } = await supabase
    .from("groupes")
    .select(
      "id, nom, annee, specialites(nom), stagiaires(count)",
    )
    .order("nom");

  if (error) throw new Error(error.message);

  return (data ?? []).map((g) => {
    const r = g as unknown as {
      id: string;
      nom: string;
      annee: number | null;
      specialites: { nom: string } | null;
      stagiaires?: { count: number }[];
    };
    const periode = periodes.get(r.id);
    return {
      id: r.id,
      nom: r.nom,
      date_debut: periode?.debut ?? null,
      date_fin: periode?.fin ?? null,
      annee: r.annee,
      specialite: r.specialites?.nom ?? null,
      stagiaires: r.stagiaires,
    };
  });
}

export async function getGroupeById(id: string): Promise<Groupe | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("groupes")
    .select("id, nom, annee, specialites(nom)")
    .eq("id", id)
    .single();

  if (error || !data) return null;

  const periode = (await getPeriodesGroupes()).get(id);
  const r = data as unknown as {
    id: string;
    nom: string;
    annee: number | null;
    specialites: { nom: string } | null;
  };
  return {
    id: r.id,
    nom: r.nom,
    date_debut: periode?.debut ?? null,
    date_fin: periode?.fin ?? null,
    annee: r.annee,
    specialite: r.specialites?.nom ?? null,
  };
}

export type Specialite = { id: string; nom: string };

/** Spécialités du référentiel, pour rattacher un groupe de 2ᵉ année. */
export async function getSpecialites(): Promise<Specialite[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("specialites")
    .select("id, nom")
    .order("nom");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createGroupe(input: {
  nom: string;
  annee?: number | null;
  specialite_id?: string | null;
  module_ids?: string[];
}) {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) throw new Error("Authentification requise.");

  const { data, error } = await supabase
    .from("groupes")
    .insert({
      nom: input.nom,
      annee: input.annee ?? null,
      // Une 2ᵉ année est forcément rattachée à une spécialité : la base le
      // vérifie (`groupes_specialite_si_annee2`), le formulaire le demande.
      specialite_id: input.annee === 2 ? (input.specialite_id ?? null) : null,
      // Sans ce champ, la politique d'écriture refuse la ligne : elle exige
      // `formateur_id = auth.uid()`. C'est ce qui bloquait toute création.
      formateur_id: user.id,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  if (input.module_ids?.length) {
    await assignModulesToGroupe(data.id, input.module_ids);
  }

  revalidatePath("/groupes");
}

export async function updateGroupe(
  id: string,
  input: {
    nom: string;
    annee?: number | null;
    module_ids?: string[];
  },
) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("groupes")
    .update({
      nom: input.nom,
      annee: input.annee ?? null,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  if (input.module_ids) {
    await assignModulesToGroupe(id, input.module_ids);
  }

  revalidatePath("/groupes");
}

export async function deleteGroupe(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("groupes").delete().eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/groupes");
}

/**
 * Aligne les modules d'un groupe sur `moduleIds`, sans toucher aux assignations
 * déjà en place : leur masse horaire allouée est une saisie du formateur, elle
 * ne doit jamais être perdue parce qu'un autre module a été coché ou décoché.
 * Une nouvelle assignation démarre sur la durée de référence du module.
 */
export async function assignModulesToGroupe(
  groupeId: string,
  moduleIds: string[],
) {
  const supabase = await createClient();

  const { data: existantes, error: errLect } = await supabase
    .from("groupe_modules")
    .select("module_id")
    .eq("groupe_id", groupeId);

  if (errLect) throw new Error(errLect.message);

  const dejaLa = new Set((existantes ?? []).map((r) => r.module_id));
  const aRetirer = [...dejaLa].filter((id) => !moduleIds.includes(id));
  const aAjouter = moduleIds.filter((id) => !dejaLa.has(id));

  if (aRetirer.length) {
    const { error } = await supabase
      .from("groupe_modules")
      .delete()
      .eq("groupe_id", groupeId)
      .in("module_id", aRetirer);
    if (error) throw new Error(error.message);
  }

  if (aAjouter.length) {
    const { data: modules, error: errModules } = await supabase
      .from("modules")
      .select("id, duree_reference")
      .in("id", aAjouter);

    if (errModules) throw new Error(errModules.message);

    const dureeParModule = new Map(
      (modules ?? []).map((m) => [m.id, Number(m.duree_reference) || 0]),
    );

    const { error } = await supabase.from("groupe_modules").insert(
      aAjouter.map((module_id) => ({
        groupe_id: groupeId,
        module_id,
        // `masse_horaire_allouee` est calculée depuis les quatre valeurs
        // semestrielles : elle ne s'écrit plus. La durée de référence part
        // en présentiel du premier semestre, à répartir ensuite.
        presentiel_s1: dureeParModule.get(module_id) ?? 0,
      })),
    );
    if (error) throw new Error(error.message);
  }

  revalidatePath("/groupes");
  revalidatePath(`/groupes/${groupeId}`);
}

/**
 * Type d'épreuve de fin de module, porté par l'assignation au groupe.
 *
 * `null` veut dire « pas encore renseigné » : c'est un état réel au moment
 * où l'on assigne un module, et le supposer local par défaut masquerait
 * justement les EFM régionaux qu'on cherche à faire ressortir.
 */
export type TypeEfmModule = "local" | "regional" | null;

/**
 * Les quatre valeurs horaires d'un couple groupe+module (PRD §4.13bis).
 *
 * Le tableau de service officiel croise deux dimensions : présentiel ou
 * distance, premier ou second semestre. La masse horaire totale et la part à
 * distance ne se saisissent plus, elles se calculent à partir de ces quatre
 * valeurs.
 */
export type HeuresSemestres = {
  presentiel_s1: number;
  fad_s1: number;
  presentiel_s2: number;
  fad_s2: number;
  /**
   * Part à distance dispensée conjointement avec un autre groupe : le groupe
   * reste crédité de ces heures pour sa progression, mais la charge du
   * formateur ne les compte qu'une fois.
   */
  fad_mutualisee: boolean;
};

export async function setMasseHoraire(
  groupeId: string,
  moduleId: string,
  heures: HeuresSemestres,
) {
  const champs: [keyof HeuresSemestres, string][] = [
    ["presentiel_s1", "le présentiel du 1er semestre"],
    ["fad_s1", "la part à distance du 1er semestre"],
    ["presentiel_s2", "le présentiel du 2e semestre"],
    ["fad_s2", "la part à distance du 2e semestre"],
  ];
  for (const [cle, libelle] of champs) {
    const valeur = heures[cle] as number;
    if (!Number.isFinite(valeur) || valeur < 0) {
      throw new Error(`Renseignez ${libelle} : un nombre positif est attendu.`);
    }
  }

  // Marquer une FAD partagée alors qu'il n'y a aucune heure à distance
  // laisserait un drapeau sans effet, qu'on retrouverait sans comprendre.
  if (heures.fad_mutualisee && heures.fad_s1 + heures.fad_s2 === 0) {
    throw new Error(
      "Sans heures à distance, il n'y a rien à partager avec un autre groupe.",
    );
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("groupe_modules")
    .update({
      presentiel_s1: heures.presentiel_s1,
      fad_s1: heures.fad_s1,
      presentiel_s2: heures.presentiel_s2,
      fad_s2: heures.fad_s2,
      fad_mutualisee: heures.fad_mutualisee,
    })
    .eq("groupe_id", groupeId)
    .eq("module_id", moduleId);

  if (error) throw new Error(error.message);

  revalidatePath(`/groupes/${groupeId}`);
  revalidatePath("/tableau-service");
  revalidatePath("/modules");
}

/**
 * Type d'EFM d'un couple groupe+module (PRD §4.1).
 *
 * Il se déclare ici plutôt qu'au moment de créer l'épreuve : un module à EFM
 * régional a une date imposée par la Direction Régionale, donc le formateur a
 * besoin de savoir lesquels le sont *avant* de décider dans quel ordre il
 * programme ses modules dans l'année.
 */
export async function setTypeEfm(
  groupeId: string,
  moduleId: string,
  type: TypeEfmModule,
) {
  if (type !== null && type !== "local" && type !== "regional") {
    throw new Error("Type d'EFM inconnu.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("groupe_modules")
    .update({ type_efm: type })
    .eq("groupe_id", groupeId)
    .eq("module_id", moduleId);

  if (error) throw new Error(error.message);

  revalidatePath(`/groupes/${groupeId}`);
}

export type GroupeModuleInfo = {
  module_id: string;
  nom: string;
  duree_reference: number;
  /** Somme des quatre valeurs semestrielles, calculée en base. */
  masse_horaire_allouee: number;
  /** Somme des deux parts à distance, calculée en base. */
  heures_fad: number;
  presentiel_s1: number;
  fad_s1: number;
  presentiel_s2: number;
  fad_s2: number;
  fad_mutualisee: boolean;
  code_operationnel: string | null;
  type_efm: TypeEfmModule;
  hasFiche: boolean;
  controleStatut: "brouillon" | "valide" | null;
};

export async function getGroupeModules(
  groupeId: string,
): Promise<GroupeModuleInfo[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("groupe_modules")
    .select(
      "module_id, masse_horaire_allouee, heures_fad, presentiel_s1, fad_s1, presentiel_s2, fad_s2, fad_mutualisee, type_efm, modules(nom, duree_reference, competences(code_operationnel))",
    )
    .eq("groupe_id", groupeId)
    .order("created_at");

  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const ids = rows.map((r) => r.module_id);

  const hasFiche = new Set<string>();
  const controleStatut = new Map<string, string>();

  if (ids.length) {
    const [fRes, cRes] = await Promise.all([
      // Une fiche est désormais rattachée à une séance : « ce module a une
      // fiche » se lit donc « une séance de ce module, dans ce groupe, en a
      // une ». Le filtre passe par la séance.
      supabase
        .from("fiches_preparation")
        .select("seances!inner(module_id, seance_groupes!inner(groupe_id))")
        .eq("seances.seance_groupes.groupe_id", groupeId)
        .in("seances.module_id", ids),
      supabase
        .from("controles")
        .select("module_id, statut")
        .eq("groupe_id", groupeId)
        .in("module_id", ids)
        .order("created_at", { ascending: false }),
    ]);

    if (fRes.error) throw new Error(fRes.error.message);
    if (cRes.error) throw new Error(cRes.error.message);

    (
      fRes.data as unknown as { seances: { module_id: string } | null }[]
    ).forEach((r) => {
      if (r.seances?.module_id) hasFiche.add(r.seances.module_id);
    });
    cRes.data.forEach((r) => {
      if (!controleStatut.has(r.module_id)) {
        controleStatut.set(r.module_id, r.statut);
      }
    });
  }

  return rows.map((r) => {
    const mod = r.modules as {
      nom?: string;
      duree_reference?: number;
      competences?: { code_operationnel?: string | null } | null;
    } | null;
    return {
      module_id: r.module_id,
      nom: mod?.nom ?? "Module",
      duree_reference: Number(mod?.duree_reference) || 0,
      masse_horaire_allouee: Number(r.masse_horaire_allouee) || 0,
      heures_fad: Number(r.heures_fad) || 0,
      presentiel_s1: Number(r.presentiel_s1) || 0,
      fad_s1: Number(r.fad_s1) || 0,
      presentiel_s2: Number(r.presentiel_s2) || 0,
      fad_s2: Number(r.fad_s2) || 0,
      fad_mutualisee: r.fad_mutualisee === true,
      code_operationnel: mod?.competences?.code_operationnel ?? null,
      type_efm: (r.type_efm as TypeEfmModule) ?? null,
      hasFiche: hasFiche.has(r.module_id),
      controleStatut:
        (controleStatut.get(r.module_id) as "brouillon" | "valide") ?? null,
    };
  });
}

export type CompteursGroupe = Partial<Record<string, number>>;

/**
 * Compteurs affichés sur les onglets d'un groupe.
 *
 * Les maquettes portent un nombre sur chaque onglet — c'est ce qui permet de
 * voir depuis n'importe quel onglet qu'il reste deux contrôles à valider. Six
 * comptes exacts en parallèle, sans rapatrier une seule ligne.
 */
export async function getCompteursGroupe(
  groupeId: string,
): Promise<CompteursGroupe> {
  const supabase = await createClient();

  const [stagiaires, modules, seances, annonces, controles, devoirs] =
    await Promise.all([
      supabase
        .from("stagiaires")
        .select("id", { count: "exact", head: true })
        .eq("groupe_id", groupeId),
      supabase
        .from("groupe_modules")
        .select("module_id", { count: "exact", head: true })
        .eq("groupe_id", groupeId),
      supabase
        .from("seances")
        .select("id, seance_groupes!inner(groupe_id)", {
          count: "exact",
          head: true,
        })
        .eq("seance_groupes.groupe_id", groupeId)
        .eq("statut", "a_faire"),
      supabase
        .from("annonces")
        .select("id", { count: "exact", head: true })
        .eq("groupe_id", groupeId),
      supabase
        .from("controles")
        .select("id", { count: "exact", head: true })
        .eq("groupe_id", groupeId)
        .eq("statut", "brouillon"),
      supabase
        .from("devoirs")
        .select("id", { count: "exact", head: true })
        .eq("groupe_id", groupeId),
    ]);

  return {
    stagiaires: stagiaires.count ?? 0,
    modules: modules.count ?? 0,
    progression: seances.count ?? 0,
    annonces: annonces.count ?? 0,
    controles: controles.count ?? 0,
    devoirs: devoirs.count ?? 0,
  };
}
