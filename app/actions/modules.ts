"use server";

import { createClient } from "@/lib/supabase/server";
import type { CycleModule } from "@/lib/modules";
import { revalidatePath } from "next/cache";
import { getPortee } from "@/app/actions/annees";
import {
  cleContenu,
  grouperParContenu,
  type DocumentModule,
  type PieceDocument,
} from "@/lib/documents-module";
import type { PieceCompilee } from "@/lib/pdf-module";
import type { Support } from "@/lib/support";

export type Module = {
  id: string;
  nom: string;
  description: string | null;
  duree_reference: number;
  /** Code court de la compétence, celui avec lequel le formateur pense. */
  code: string | null;
  /** Cycle de la compétence : c'est lui qui donne l'année de formation. */
  cycle: CycleModule;
  /** Nombre de groupes auxquels le module est assigné. */
  groupes: number;
  /**
   * Somme des masses horaires allouées, tous groupes confondus.
   *
   * C'est la charge réelle du module — pas sa durée nationale de référence.
   * Un module enseigné à deux groupes compte deux fois, avec la valeur propre
   * à chaque groupe (PRD §4.1).
   */
  masseHoraireAllouee: number;
};

export async function getModules(): Promise<Module[]> {
  const supabase = await createClient();
  // PRD §4.15 : le module reste du référentiel, permanent et partagé entre
  // les années — mais les heures qui lui sont allouées appartiennent à une
  // année précise. Le total et le nombre de groupes se bornent donc à
  // l'année sélectionnée, l'existence du module non.
  const { groupeIds } = await getPortee();

  // Colonnes explicites plutôt que `*` (conventions.md), et le code
  // opérationnel de la compétence, qui est ce que le formateur lit en premier.
  const [modulesRes, assignationsRes] = await Promise.all([
    supabase
      .from("modules")
      .select(
        "id, nom, description, duree_reference, competences(code_operationnel, cycle)",
      )
      .order("nom"),
    supabase
      .from("groupe_modules")
      .select("module_id, masse_horaire_allouee")
      .in("groupe_id", groupeIds),
  ]);

  if (modulesRes.error) throw new Error(modulesRes.error.message);
  if (assignationsRes.error) throw new Error(assignationsRes.error.message);

  const parModule = new Map<string, number>();
  const heuresParModule = new Map<string, number>();
  for (const a of assignationsRes.data ?? []) {
    const id = a.module_id as string;
    parModule.set(id, (parModule.get(id) ?? 0) + 1);
    heuresParModule.set(
      id,
      (heuresParModule.get(id) ?? 0) + (Number(a.masse_horaire_allouee) || 0),
    );
  }

  return (modulesRes.data ?? []).map((m) => {
    const r = m as unknown as {
      id: string;
      nom: string;
      description: string | null;
      duree_reference: number;
      competences: {
        code_operationnel: string | null;
        cycle: CycleModule;
      } | null;
    };
    return {
      id: r.id,
      nom: r.nom,
      description: r.description,
      duree_reference: r.duree_reference,
      code: r.competences?.code_operationnel ?? null,
      cycle: r.competences?.cycle ?? null,
      groupes: parModule.get(r.id) ?? 0,
      masseHoraireAllouee: heuresParModule.get(r.id) ?? 0,
    };
  });
}

export type ModuleControleInfo = {
  id: string;
  titre: string | null;
  statut: "brouillon" | "valide";
  /**
   * Le groupe auquel ce contrôle appartient (§4.7 : un contrôle vit sur un
   * couple groupe+module, jamais sur le module seul).
   *
   * Sans lui, deux groupes suivant le même module produisaient quatre lignes
   * au titre identique, et rien pour les distinguer — alors que la donnée
   * était en base depuis toujours.
   */
  groupeId: string;
  groupeNom: string;
};

/** Compétence du référentiel dont le module est la déclinaison opérationnelle. */
export type CompetenceLiee = {
  numero: number;
  code_operationnel: string | null;
  /** Valeur officielle du programme. Jamais modifiée localement. */
  duree_nationale_heures: number | null;
};

/**
 * Le module tel que la table le porte, sans les champs calculés de `Module`.
 *
 * `ModuleDetail.module` était typé `Module`, qui promet un `code` et un
 * `groupes` que cette requête ne rapporte pas : les deux étaient `undefined`
 * à l'exécution tout en étant déclarés présents. Le détail expose la
 * compétence et les groupes à côté, c'est là qu'il faut les lire.
 */
export type ModuleBrut = {
  id: string;
  nom: string;
  description: string | null;
  duree_reference: number;
  competence_id: string | null;
};

export type ModuleDetail = {
  module: ModuleBrut;
  competence: CompetenceLiee | null;
  controles: ModuleControleInfo[];
  hasFiche: boolean;
  groupes: { id: string; nom: string }[];
};

export async function getModuleDetail(
  moduleId: string,
): Promise<ModuleDetail | null> {
  const supabase = await createClient();
  // Les groupes listés sur la fiche du module sont ceux de l'année en cours.
  const { groupeIds } = await getPortee();

  const [mod, fiche, groupes, controles] = await Promise.all([
    supabase
      .from("modules")
      .select(
        "*, competences(numero, code_operationnel, duree_nationale_heures)",
      )
      .eq("id", moduleId)
      .single(),
    supabase
      .from("fiches_preparation")
      .select("id, seances!inner(module_id)", { count: "exact", head: true })
      .eq("seances.module_id", moduleId),
    supabase
      .from("groupe_modules")
      .select("groupes(id, nom)")
      .eq("module_id", moduleId)
      .in("groupe_id", groupeIds)
      .order("created_at"),
    supabase
      .from("controles")
      .select("id, titre, statut, groupe_id, groupes(nom)")
      .eq("module_id", moduleId)
      .in("groupe_id", groupeIds)
      // Groupe d'abord, puis du plus récent au plus ancien : les contrôles
      // d'un même groupe se lisent ensemble.
      .order("groupe_id")
      .order("created_at", { ascending: false }),
  ]);

  if (mod.error || !mod.data) return null;
  if (fiche.error) throw new Error(fiche.error.message);
  if (groupes.error) throw new Error(groupes.error.message);
  if (controles.error) throw new Error(controles.error.message);

  const brut = mod.data as ModuleBrut & {
    competences?: CompetenceLiee | null;
  };

  return {
    module: brut,
    competence: brut.competences ?? null,
    hasFiche: (fiche.count ?? 0) > 0,
    groupes: (groupes.data ?? []).map((g) => {
      const raw = Array.isArray(g.groupes) ? g.groupes[0] : g.groupes;
      const gr = raw as { id: string; nom: string } | null;
      return { id: gr?.id ?? "", nom: gr?.nom ?? "Groupe" };
    }),
    controles: (
      (controles.data ?? []) as unknown as {
        id: string;
        titre: string | null;
        statut: "brouillon" | "valide";
        groupe_id: string;
        groupes: { nom: string } | null;
      }[]
    )
      .map((c) => ({
        id: c.id,
        titre: c.titre,
        statut: c.statut,
        groupeId: c.groupe_id,
        groupeNom: c.groupes?.nom ?? "Groupe",
      }))
      // Le tri par identifiant de groupe ne dit rien au lecteur : on reprend
      // par nom, DES101 avant DES102.
      .sort((a, b) => a.groupeNom.localeCompare(b.groupeNom, "fr")),
  };
}

export type CompetenceDisponible = {
  id: string;
  numero: number;
  code: string | null;
  codeOfficiel: string | null;
  nom: string;
  dureeHeures: number | null;
  /** Un module décline déjà cette compétence. */
  dejaDeclinee: boolean;
};

/**
 * Compétences du référentiel, pour le choix à l'ajout d'un module.
 *
 * Un module n'est pas inventé : c'est la déclinaison d'une compétence du
 * programme officiel. Faire retaper l'intitulé et la durée nationale à la main
 * invitait à la faute de frappe, et laissait surtout `competence_id` vide —
 * le module perdait alors son code et son rattachement au référentiel.
 */
export async function getCompetencesDisponibles(): Promise<
  CompetenceDisponible[]
> {
  const supabase = await createClient();

  const [competencesRes, modulesRes] = await Promise.all([
    supabase
      .from("competences")
      .select(
        "id, numero, code_operationnel, code_officiel, nom, duree_nationale_heures",
      )
      .order("numero"),
    supabase.from("modules").select("competence_id"),
  ]);

  if (competencesRes.error) throw new Error(competencesRes.error.message);
  if (modulesRes.error) throw new Error(modulesRes.error.message);

  const prises = new Set(
    (modulesRes.data ?? [])
      .map((m) => m.competence_id)
      .filter((id): id is string => Boolean(id)),
  );

  return (competencesRes.data ?? []).map((c) => ({
    id: c.id,
    numero: c.numero,
    code: c.code_operationnel,
    codeOfficiel: c.code_officiel,
    nom: c.nom,
    dureeHeures: c.duree_nationale_heures,
    dejaDeclinee: prises.has(c.id),
  }));
}

export async function createModule(input: {
  nom: string;
  description?: string | null;
  duree_reference: number;
  competence_id?: string | null;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("modules").insert({
    nom: input.nom,
    description: input.description ?? null,
    duree_reference: input.duree_reference,
    competence_id: input.competence_id ?? null,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/modules");
}

export async function updateModule(
  id: string,
  input: {
    nom: string;
    description?: string | null;
    duree_reference: number;
  },
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("modules")
    .update({
      nom: input.nom,
      description: input.description ?? null,
      duree_reference: input.duree_reference,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/modules");
}

/**
 * Ajuste la durée de référence d'un module. Ce n'est qu'un repère local :
 * la durée officielle du programme reste celle de la compétence, et les masses
 * horaires déjà allouées par groupe ne sont pas touchées.
 */
export async function setDureeReference(moduleId: string, heures: number) {
  if (!Number.isFinite(heures) || heures < 0) {
    throw new Error("La durée de référence doit être un nombre positif.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("modules")
    .update({ duree_reference: heures })
    .eq("id", moduleId);

  if (error) throw new Error(error.message);

  revalidatePath("/modules");
  revalidatePath(`/modules/${moduleId}`);
}

export async function deleteModule(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("modules").delete().eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/modules");
}

/**
 * Les deux documents d'un module, séance par séance (PRD §4.4).
 *
 * Le découpage suit la nature de la séance : une séance théorique alimente le
 * support de cours, une séance pratique le document de TP. Les séances sans
 * nature déclarée rejoignent le cours, qui est le cas par défaut du produit.
 *
 * Un groupe peut être demandé : deux groupes suivent le même module à des
 * dates différentes, et le document d'un groupe n'est pas celui de l'autre.
 * Sans groupe, on prend tout le module — c'est la vue du formateur qui
 * prépare, pas celle qui remet.
 */
export async function getDocumentsModule(
  moduleId: string,
  groupeId?: string,
): Promise<DocumentModule[]> {
  const supabase = await createClient();

  let requete = supabase
    .from("seances")
    .select(
      "id, date, statut, nature, contenu_source_id, objectif_operationnel, suggestions_pedagogiques(code, apprentissage_base), seance_groupes!inner(groupe_id)",
    )
    .eq("module_id", moduleId)
    .order("date", { ascending: true, nullsFirst: false });
  if (groupeId) requete = requete.eq("seance_groupes.groupe_id", groupeId);

  const { data, error } = await requete;
  if (error) throw new Error(error.message);

  const seances = (data ?? []) as unknown as {
    id: string;
    date: string | null;
    statut: string;
    nature: "theorique" | "pratique" | null;
    contenu_source_id: string | null;
    objectif_operationnel: string | null;
    suggestions_pedagogiques: {
      code: string | null;
      apprentissage_base: string;
    } | null;
  }[];

  if (seances.length === 0) {
    return [
      { genre: "cours", titre: "", pieces: [] },
      { genre: "pratique", titre: "", pieces: [] },
    ];
  }

  // §4.3bis : une séance miroir n'a pas de support à elle. Compter sur son
  // seul identifiant la dirait « non rédigée » alors qu'elle en affiche un.
  const sourceDe = new Map(
    seances.map((s) => [s.id, s.contenu_source_id ?? s.id]),
  );
  const sources = [...new Set(sourceDe.values())];

  const [supportsRes, correctionsRes] = await Promise.all([
    // Seul le support du stagiaire compte comme « support fait » : celui du
    // formateur ne se remet pas, il ne remplit pas la case.
    supabase
      .from("supports_seance")
      .select("seance_id")
      .in("seance_id", sources)
      .eq("destinataire", "stagiaire"),
    supabase
      .from("corrections_tp")
      .select("seance_id")
      .in("seance_id", sources),
  ]);

  const avecSupport = new Set((supportsRes.data ?? []).map((r) => r.seance_id));
  const avecCorrection = new Set(
    (correctionsRes.data ?? []).map((r) => r.seance_id),
  );

  // Une entrée par contenu, pas par séance : deux groupes parallèles suivent
  // le même cours, et un objectif étalé sur plusieurs créneaux reste un seul
  // chapitre du document.
  const cle = (s: (typeof seances)[number]) =>
    cleContenu({
      objectifCode: s.suggestions_pedagogiques?.code ?? null,
      objectifLibelle: s.objectif_operationnel,
      nature: s.nature,
    });

  const piece = (paquet: (typeof seances)[number][]): PieceDocument => {
    const premiere = paquet[0]!;
    const sources = paquet.map((s) => sourceDe.get(s.id) ?? s.id);
    return {
      seanceId: premiere.id,
      seances: paquet.length,
      date: premiere.date,
      titre:
        premiere.suggestions_pedagogiques?.apprentissage_base ??
        premiere.objectif_operationnel ??
        "Séance",
      objectif: premiere.suggestions_pedagogiques?.code ?? null,
      // Compté séance par séance : le contenu est le même, mais chaque séance
      // a besoin de son support pour que le stagiaire qui l'ouvre voie quelque
      // chose.
      redigees: sources.filter((id) => avecSupport.has(id)).length,
      // Fait quand toutes le sont — le contenu n'est couvert qu'à la dernière.
      faite: paquet.every((s) => s.statut === "fait"),
      corrigees: sources.filter((id) => avecCorrection.has(id)).length,
    };
  };

  const pour = (genre: "cours" | "pratique") =>
    grouperParContenu(
      seances.filter((s) =>
        genre === "pratique"
          ? s.nature === "pratique"
          : s.nature !== "pratique",
      ),
      cle,
    ).map(piece);

  return [
    { genre: "cours", titre: "", pieces: pour("cours") },
    { genre: "pratique", titre: "", pieces: pour("pratique") },
  ];
}

/**
 * Le contenu compilé d'un des deux documents d'un module (PRD §4.4).
 *
 * Ne renvoie que les séances qui ont réellement un support : une compilation
 * n'a pas à contenir des chapitres vides pour les séances non encore
 * rédigées. Le rang imprimé suit l'ordre du programme, pas la position dans
 * la liste filtrée — sauter la séance 3 ne doit pas renuméroter la 4 en 3.
 */
export async function getCompilationModule(
  moduleId: string,
  genre: "cours" | "pratique",
  groupeId?: string,
): Promise<PieceCompilee[]> {
  const supabase = await createClient();

  let requete = supabase
    .from("seances")
    .select(
      "id, date, nature, contenu_source_id, objectif_operationnel, suggestions_pedagogiques(code, apprentissage_base), seance_groupes!inner(groupe_id)",
    )
    .eq("module_id", moduleId)
    .order("date", { ascending: true, nullsFirst: false });
  if (groupeId) requete = requete.eq("seance_groupes.groupe_id", groupeId);

  const { data, error } = await requete;
  if (error) throw new Error(error.message);

  const toutes = (data ?? []) as unknown as {
    id: string;
    date: string | null;
    nature: "theorique" | "pratique" | null;
    contenu_source_id: string | null;
    objectif_operationnel: string | null;
    suggestions_pedagogiques: {
      code: string | null;
      apprentissage_base: string;
    } | null;
  }[];

  const retenues = toutes.filter((s) =>
    genre === "pratique" ? s.nature === "pratique" : s.nature !== "pratique",
  );
  if (retenues.length === 0) return [];

  // §4.3bis : une séance miroir tire son support de sa source.
  const sourceDe = new Map(
    retenues.map((s) => [s.id, s.contenu_source_id ?? s.id]),
  );

  // Le classeur compile ce qui a été remis aux stagiaires. Le support que le
  // formateur garde pour lui n'y entre pas.
  const { data: supports } = await supabase
    .from("supports_seance")
    .select("seance_id, contenu, version, type")
    .in("seance_id", [...new Set(sourceDe.values())])
    .eq("type", genre === "pratique" ? "pratique" : "theorique")
    .eq("destinataire", "stagiaire")
    .order("version", { ascending: false });

  const dernier = new Map<string, Support>();
  for (const s of supports ?? []) {
    if (!dernier.has(s.seance_id))
      dernier.set(s.seance_id, s.contenu as Support);
  }

  // Un chapitre par contenu, comme la liste à l'écran : sans ce regroupement,
  // la compilation de M104 imprimerait quatre fois le même cours — deux
  // groupes parallèles × deux créneaux par objectif.
  const paquets = grouperParContenu(retenues, (s) =>
    cleContenu({
      objectifCode: s.suggestions_pedagogiques?.code ?? null,
      objectifLibelle: s.objectif_operationnel,
      nature: s.nature,
    }),
  );

  const pieces: PieceCompilee[] = [];
  paquets.forEach((paquet, i) => {
    const premiere = paquet[0]!;
    // Le support de la première séance du paquet qui en porte un : le contenu
    // est le même, seule son écriture peut manquer sur certaines instances.
    const support = paquet
      .map((s) => dernier.get(sourceDe.get(s.id) ?? s.id))
      .find(Boolean);
    if (!support) return;
    pieces.push({
      rang: i + 1,
      date: premiere.date,
      objectif: premiere.suggestions_pedagogiques?.code ?? null,
      titre:
        premiere.suggestions_pedagogiques?.apprentissage_base ??
        premiere.objectif_operationnel ??
        "Séance",
      support,
    });
  });

  return pieces;
}
