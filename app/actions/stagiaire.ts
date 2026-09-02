"use server";

import { createClient, getUser } from "@/lib/supabase/server";

export type IdentiteStagiaire = {
  stagiaireId: string;
  nom: string;
  prenom: string;
  groupeId: string;
  groupeNom: string;
  /** Année de formation du groupe, affichée sous le nom en tête d'écran. */
  annee: number | null;
};

/**
 * Identité du stagiaire connecté.
 *
 * Renvoie null pour un formateur : c'est ce qui permet à chaque espace de
 * rediriger vers l'autre plutôt que d'afficher une page vide.
 */
export async function getIdentiteStagiaire(): Promise<IdentiteStagiaire | null> {
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("stagiaires")
    .select("id, nom, prenom, groupe_id, groupes(nom, annee)")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return null;

  const s = data as unknown as {
    id: string;
    nom: string;
    prenom: string;
    groupe_id: string;
    groupes: { nom: string; annee: number | null } | null;
  };

  return {
    stagiaireId: s.id,
    nom: s.nom,
    prenom: s.prenom,
    groupeId: s.groupe_id,
    groupeNom: s.groupes?.nom ?? "—",
    annee: s.groupes?.annee ?? null,
  };
}

export type EvenementStagiaire = {
  id: string;
  genre: "seance" | "controle";
  date: string;
  heure_debut: string | null;
  heure_fin: string | null;
  titre: string;
  moduleNom: string | null;
  codeOperationnel: string | null;
  nature: "theorique" | "pratique" | null;
  statut: string | null;
  /** Contrôles seulement : distingue un CC d'une épreuve de fin de module. */
  typeControle: "CC" | "EFM" | null;
  typeEfm: "local" | "regional" | null;
  dureeHeures: number | null;
  /** Séances seulement : le support publié, s'il existe déjà. */
  supportId: string | null;
};

/**
 * Emploi du temps du stagiaire : ses séances datées et les dates de contrôle
 * de son groupe, dans un seul fil chronologique.
 *
 * Les deux sont mêlés à dessein — un stagiaire ne pense pas « séances » d'un
 * côté et « contrôles » de l'autre, il regarde ce qui l'attend.
 */
export async function getMonEmploiDuTemps(): Promise<EvenementStagiaire[]> {
  const identite = await getIdentiteStagiaire();
  if (!identite) return [];

  const supabase = await createClient();

  const [seancesRes, controlesRes] = await Promise.all([
    supabase
      .from("seances")
      .select(
        "id, date, heure_debut, heure_fin, statut, nature, objectif_operationnel, modules(nom, competences(code_operationnel)), supports_seance(id), seance_groupes!inner(groupe_id)",
      )
      .eq("seance_groupes.groupe_id", identite.groupeId)
      .not("date", "is", null),
    supabase
      .from("controles")
      .select(
        "id, titre, type, type_efm, date_prevue, date_administration, duree_heures, modules(nom, competences(code_operationnel))",
      )
      .eq("groupe_id", identite.groupeId),
  ]);

  if (seancesRes.error) throw new Error(seancesRes.error.message);
  if (controlesRes.error) throw new Error(controlesRes.error.message);

  const seances = (seancesRes.data ?? []).map((s) => {
    const r = s as unknown as {
      id: string;
      date: string;
      heure_debut: string | null;
      heure_fin: string | null;
      statut: string;
      nature: "theorique" | "pratique" | null;
      objectif_operationnel: string | null;
      modules: {
        nom: string;
        competences: { code_operationnel: string | null } | null;
      } | null;
      supports_seance: { id: string }[] | null;
    };
    return {
      id: r.id,
      genre: "seance" as const,
      date: r.date,
      heure_debut: r.heure_debut,
      heure_fin: r.heure_fin,
      titre: r.objectif_operationnel ?? r.modules?.nom ?? "Séance",
      moduleNom: r.modules?.nom ?? null,
      codeOperationnel: r.modules?.competences?.code_operationnel ?? null,
      nature: r.nature,
      statut: r.statut,
      typeControle: null,
      typeEfm: null,
      dureeHeures: null,
      supportId: r.supports_seance?.[0]?.id ?? null,
    };
  });

  const controles = (controlesRes.data ?? [])
    .map((c) => {
      const r = c as unknown as {
        id: string;
        titre: string | null;
        type: "CC" | "EFM";
        type_efm: "local" | "regional" | null;
        date_prevue: string | null;
        date_administration: string | null;
        duree_heures: number | null;
        modules: {
          nom: string;
          competences: { code_operationnel: string | null } | null;
        } | null;
      };
      const date = r.date_administration ?? r.date_prevue;
      // Un contrôle sans date n'a pas sa place dans un emploi du temps.
      if (!date) return null;
      return {
        id: r.id,
        genre: "controle" as const,
        date,
        heure_debut: null,
        heure_fin: null,
        titre: r.titre ?? (r.type === "EFM" ? "Épreuve de fin de module" : "Contrôle continu"),
        moduleNom: r.modules?.nom ?? null,
        codeOperationnel: r.modules?.competences?.code_operationnel ?? null,
        nature: null,
        statut: null,
        typeControle: r.type,
        typeEfm: r.type_efm,
        dureeHeures: r.duree_heures,
        supportId: null,
      };
    })
    .filter((c) => c !== null);

  return [...seances, ...controles].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.heure_debut ?? "").localeCompare(b.heure_debut ?? ""),
  );
}
