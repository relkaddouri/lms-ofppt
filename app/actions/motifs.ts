"use server";

import { createClient, getUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getPortee } from "@/app/actions/annees";
import {
  choisirPorteur,
  cleCreneau,
  composerIntitule,
  creneauOuvert,
  dureeCreneau,
  remplirCreneaux,
  seanceDeplacable,
  type BlocContenu,
  type CreneauCible,
  type Instant,
} from "@/lib/remplissage";
import { instantEtablissement } from "@/lib/format";
import { creneauALieu, type Recurrence } from "@/lib/recurrence";
import type { Replanification } from "@/lib/motifs";

export type CreneauMotif = {
  id: string;
  jour_semaine: number;
  heure_debut: string;
  heure_fin: string;
  groupe_id: string;
  groupeNom: string;
  /** Chaque semaine, une semaine sur deux, ou une fois par mois (migration 087). */
  recurrence: Recurrence;
  /** Première occurrence d'un créneau alterné ; nulle s'il est hebdomadaire. */
  premiere_date: string | null;
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

  // PRD §4.15 : le rythme hebdomadaire ne se reconduit pas d'une année sur
  // l'autre, il se redéclare. Les motifs des années passées restent en base
  // mais ne se mélangent pas à celui en cours.
  const { anneeId } = await getPortee();

  const { data, error } = await supabase
    .from("motifs_hebdomadaires")
    .select(
      "id, libelle, date_debut, date_fin, creneaux_motif(id, jour_semaine, heure_debut, heure_fin, groupe_id, recurrence, premiere_date, groupes(nom))",
    )
    .eq("annee_scolaire_id", anneeId ?? "")
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
        recurrence: Recurrence;
        premiere_date: string | null;
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
          recurrence: c.recurrence,
          premiere_date: c.premiere_date,
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
  recurrence?: Recurrence;
  premiereDate?: string | null;
}): Promise<Replanification> {
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
    ...rythme(input),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/emploi-du-temps");
  return replanifier([input.groupeId]);
}

/**
 * Le rythme d'un créneau, vérifié avant d'écrire.
 *
 * La base refuse déjà un créneau alterné sans première date, ou dont la
 * première date ne tombe pas le bon jour ; on le dit ici en français plutôt
 * que de laisser remonter le nom d'une contrainte.
 */
function rythme(input: {
  jour: number;
  recurrence?: Recurrence;
  premiereDate?: string | null;
}): { recurrence: Recurrence; premiere_date: string | null } {
  const recurrence = input.recurrence ?? "hebdomadaire";
  if (recurrence === "hebdomadaire") {
    return { recurrence, premiere_date: null };
  }
  if (!input.premiereDate) {
    throw new Error(
      "Indiquez la première fois : c'est elle qui fixe les semaines du créneau.",
    );
  }
  const d = new Date(`${input.premiereDate}T12:00:00Z`);
  const isodow = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  if (isodow !== input.jour) {
    throw new Error("La première fois doit tomber le jour du créneau.");
  }
  return { recurrence, premiere_date: input.premiereDate };
}

/**
 * Déplace un créneau existant — horaire, jour, ou groupe.
 *
 * Le PRD §4.9 nomme ce cas explicitement : c'est celui qui manquait. Passer
 * par « supprimer puis rajouter » perdait le lien avec le placement existant
 * et, surtout, ne recalculait rien. Les deux groupes concernés sont replacés
 * quand le créneau change de main.
 */
export async function modifierCreneau(input: {
  id: string;
  jour: number;
  heureDebut: string;
  heureFin: string;
  groupeId: string;
  recurrence?: Recurrence;
  premiereDate?: string | null;
}): Promise<Replanification> {
  if (input.heureFin <= input.heureDebut) {
    throw new Error("L'heure de fin doit suivre l'heure de début.");
  }

  const supabase = await createClient();

  const { data: avant, error: errLecture } = await supabase
    .from("creneaux_motif")
    .select("groupe_id")
    .eq("id", input.id)
    .maybeSingle();
  if (errLecture) throw new Error(errLecture.message);
  if (!avant) throw new Error("Créneau introuvable.");

  const { error } = await supabase
    .from("creneaux_motif")
    .update({
      jour_semaine: input.jour,
      heure_debut: input.heureDebut,
      heure_fin: input.heureFin,
      groupe_id: input.groupeId,
      ...rythme(input),
    })
    .eq("id", input.id);
  if (error) throw new Error(error.message);

  revalidatePath("/emploi-du-temps");
  return replanifier([...new Set([avant.groupe_id, input.groupeId])]);
}

export async function supprimerCreneau(id: string): Promise<Replanification> {
  const supabase = await createClient();

  // Le groupe se lit avant la suppression : après, plus rien ne dit quel
  // calendrier vient d'être privé d'un créneau.
  const { data: avant } = await supabase
    .from("creneaux_motif")
    .select("groupe_id")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase.from("creneaux_motif").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/emploi-du-temps");
  return replanifier(avant ? [avant.groupe_id] : []);
}

/**
 * Recalcul du placement des séances non réalisées (PRD §4.9).
 *
 * Tout changement qui déplace les créneaux — motif ou jour non travaillé —
 * appelle ceci. Sans quoi le calendrier reste figé sur l'ancien placement,
 * silencieusement faux : c'est le bug constaté sur un férié saisi à la
 * mauvaise date puis supprimé, et de nouveau sur un créneau déplacé d'une
 * demi-journée à l'autre.
 *
 * Trois garanties, dans cet ordre :
 *
 * 1. Le passé n'est jamais touché. Une séance **faite** est un fait ; une
 *    séance « à faire » dont l'heure est passée aussi — le formateur coche
 *    souvent le lendemain, et la traiter comme une prévision la renvoyait
 *    après aujourd'hui, son créneau passé ne pouvant plus rien recevoir. Le
 *    recalcul repart du lendemain de la dernière séance faite, et jamais
 *    avant l'instant présent ; aucun créneau déjà occupé n'est rempli.
 * 2. Un groupe que le motif ne sert plus n'est **pas** libéré : détacher ses
 *    séances de leurs dates les ferait disparaître du calendrier sans que
 *    rien ne les y remette. Il est signalé, pas vidé.
 * 3. Les séances « à faire » sont détachées puis replacées par le même
 *    remplissage que la génération initiale — même ordre pédagogique, mêmes
 *    créneaux entièrement occupés.
 */
export async function replanifier(
  groupeIds: string[],
): Promise<Replanification> {
  const supabase = await createClient();
  const { anneeId } = await getPortee();
  const groupes: Replanification["groupes"] = [];
  // Un seul instant pour tout le recalcul : lu groupe par groupe, il pourrait
  // basculer d'une minute entre deux, et une séance changer de camp.
  const instant = instantEtablissement();

  const uniques = [...new Set(groupeIds)].filter(Boolean);
  if (uniques.length === 0) return { groupes };

  const { data: nomsRes } = await supabase
    .from("groupes")
    .select("id, nom")
    .in("id", uniques);
  const noms = new Map((nomsRes ?? []).map((g) => [g.id, g.nom]));

  // Le motif en vigueur : celui qui n'a pas encore de date de fin.
  const { data: motifRes } = await supabase
    .from("motifs_hebdomadaires")
    .select("date_debut, creneaux_motif(groupe_id)")
    .eq("annee_scolaire_id", anneeId ?? "")
    .is("date_fin", null)
    .order("date_debut", { ascending: false })
    .limit(1);

  const motif = motifRes?.[0];
  if (!motif) return { groupes };

  const servis = new Set(
    ((motif.creneaux_motif ?? []) as { groupe_id: string }[]).map(
      (c) => c.groupe_id,
    ),
  );

  for (const groupeId of uniques) {
    const nom = noms.get(groupeId) ?? "Groupe";

    if (!servis.has(groupeId)) {
      groupes.push({
        nom,
        liberees: 0,
        placees: 0,
        heuresRestantes: 0,
        sansCreneau: true,
      });
      continue;
    }

    // Le lendemain de la dernière séance faite borne le recalcul par le bas.
    const { data: derniereFaite } = await supabase
      .from("seances")
      .select("date, seance_groupes!inner(groupe_id)")
      .eq("seance_groupes.groupe_id", groupeId)
      .eq("statut", "fait")
      .not("date", "is", null)
      .order("date", { ascending: false })
      .limit(1);

    const apresLeFait = derniereFaite?.[0]?.date
      ? new Date(`${derniereFaite[0].date}T12:00:00Z`)
      : null;
    if (apresLeFait) apresLeFait.setUTCDate(apresLeFait.getUTCDate() + 1);

    const candidats = [instant.date, motif.date_debut];
    if (apresLeFait) candidats.push(apresLeFait.toISOString().slice(0, 10));
    const depart = candidats.sort().at(-1)!;

    const { data: dateesAFaire, error: errLecture } = await supabase
      .from("seances")
      .select(
        "id, date, heure_debut, heure_fin, seance_groupes!inner(groupe_id)",
      )
      .eq("seance_groupes.groupe_id", groupeId)
      .eq("statut", "a_faire")
      .gte("date", depart);
    if (errLecture) throw new Error(errLecture.message);

    // Seules les séances à venir se détachent. Celles dont l'heure est
    // passée restent en place, et occupent leur créneau pour la suite.
    const aLiberer = (dateesAFaire ?? []).filter(
      (s) =>
        s.date !== null &&
        seanceDeplacable(
          { date: s.date, heure_debut: s.heure_debut },
          depart,
          instant,
        ),
    );

    const ids = aLiberer.map((s) => s.id);
    if (ids.length > 0) {
      const { error } = await supabase
        .from("seances")
        .update({
          date: null,
          heure_debut: null,
          heure_fin: null,
          updated_at: new Date().toISOString(),
        })
        .in("id", ids);
      if (error) throw new Error(error.message);
    }

    let r: ResultatGeneration;
    try {
      r = await genererSeances(groupeId, depart, 40, instant);
    } catch (e) {
      // Le remplissage a refusé ou échoué : les séances détachées retrouvent
      // leur place. Sans cela, elles restaient sans date — hors du
      // calendrier, sans que rien ne dise où elles étaient.
      for (const s of aLiberer) {
        await supabase
          .from("seances")
          .update({
            date: s.date,
            heure_debut: s.heure_debut,
            heure_fin: s.heure_fin,
          })
          .eq("id", s.id)
          .is("date", null);
      }
      throw e;
    }
    groupes.push({
      nom,
      liberees: ids.length,
      placees: r.placees,
      heuresRestantes: r.heuresRestantes,
      sansCreneau: false,
    });
  }

  revalidatePath("/calendrier");
  revalidatePath("/emploi-du-temps");
  revalidatePath("/groupes", "layout");
  return { groupes };
}

export type ResultatGeneration = {
  /** Nombre de séances écrites, une par créneau rempli. */
  placees: number;
  /**
   * Heures de contenu qui n'ont trouvé aucun créneau dans l'horizon —
   * des heures, non des séances : depuis que le créneau décide des frontières,
   * ce qui reste est une durée, pas un nombre de séances.
   */
  heuresRestantes: number;
  joursSautes: number;
  derniereDate: string | null;
};

/**
 * Remplit les créneaux du motif avec le contenu non encore daté du groupe.
 *
 * Le générateur ne décide pas du contenu — la répartition horaire (§4.1) l'a
 * produit, dans l'ordre du référentiel — mais il décide désormais des
 * **frontières des séances**, ce que faisait auparavant le découpage en blocs.
 *
 * La raison est dans le PRD §4.9 : un créneau doit être entièrement occupé.
 * Placer chaque bloc dans son propre créneau laissait une séance de 2 h 30
 * seule dans un créneau de 5 h — et 2 h 30 qui n'existaient nulle part, ni
 * ici ni dans la déclaration E-note que le formateur doit produire. Le
 * remplissage consomme donc la séquence pédagogique créneau par créneau :
 * une séance peut porter deux objectifs, un objectif peut se scinder sur deux
 * séances.
 */
export async function genererSeances(
  groupeId: string,
  dateDebut: string,
  semainesMax = 40,
  /**
   * Le présent, transmis par un recalcul : aucun créneau déjà commencé ne
   * reçoit alors de séance. Une génération lancée à la main n'en passe pas —
   * partir d'une date passée y est un choix.
   */
  instant?: Instant,
): Promise<ResultatGeneration> {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) throw new Error("Authentification requise.");

  const { anneeId: porteeId } = await getPortee();

  const [motifRes, seancesRes, indispoRes, occupesRes] = await Promise.all([
    supabase
      .from("motifs_hebdomadaires")
      .select(
        "id, date_fin, creneaux_motif(jour_semaine, heure_debut, heure_fin, groupe_id, recurrence, premiere_date)",
      )
      .eq("annee_scolaire_id", porteeId ?? "")
      .lte("date_debut", dateDebut)
      .order("date_debut", { ascending: false })
      .limit(1),
    supabase
      .from("seances")
      .select(
        "id, module_id, created_at, duree_prevue, nature, suggestion_pedagogique_id, contenu_prevu, objectif_operationnel, est_fad, lien_teams, seance_groupes!inner(groupe_id), seance_elements_contenu(element_contenu_id), suggestions_pedagogiques(ordre, elements_competence(lettre, ordre))",
      )
      .eq("seance_groupes.groupe_id", groupeId)
      .is("date", null)
      .order("created_at"),
    supabase
      .from("indisponibilites")
      .select("date_debut, date_fin, demi_journee")
      .eq("annee_scolaire_id", porteeId ?? ""),
    // Ce qui occupe déjà un créneau : séances faites, et séances passées que
    // le recalcul a laissées en place. Y écrire créerait deux séances à la
    // même heure.
    supabase
      .from("seances")
      .select("date, heure_debut, seance_groupes!inner(groupe_id)")
      .eq("seance_groupes.groupe_id", groupeId)
      .gte("date", dateDebut),
  ]);

  if (motifRes.error) throw new Error(motifRes.error.message);
  if (seancesRes.error) throw new Error(seancesRes.error.message);
  if (indispoRes.error) throw new Error(indispoRes.error.message);
  if (occupesRes.error) throw new Error(occupesRes.error.message);

  const occupes = new Set(
    (occupesRes.data ?? [])
      .filter((o) => o.date && o.heure_debut)
      .map((o) => cleCreneau(o.date!, o.heure_debut!)),
  );

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
    return {
      placees: 0,
      heuresRestantes: 0,
      joursSautes: 0,
      derniereDate: null,
    };
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

  // ── La suite des créneaux ouverts, dans l'ordre chronologique ──────────
  //
  // On les construit avant de placer quoi que ce soit : le remplissage a
  // besoin de voir la taille de chaque créneau pour décider où couper.
  const cibles: CreneauCible[] = [];
  let joursSautes = 0;
  const curseur = new Date(`${dateDebut}T12:00:00Z`);
  const limite = new Date(curseur);
  limite.setUTCDate(limite.getUTCDate() + semainesMax * 7);
  const finMotif = motif.date_fin
    ? new Date(`${motif.date_fin}T12:00:00Z`)
    : null;

  const heuresAPlacer = aPlacer.reduce(
    (t, s) => t + (Number(s.duree_prevue) || 0),
    0,
  );
  let heuresOuvertes = 0;

  while (heuresOuvertes < heuresAPlacer && curseur <= limite) {
    if (finMotif && curseur > finMotif) break;

    const iso = curseur.toISOString().slice(0, 10);
    const isodow = curseur.getUTCDay() === 0 ? 7 : curseur.getUTCDay();

    // Les créneaux de ce jour-là — et seulement ceux dont c'est la semaine :
    // un créneau une semaine sur deux, ou mensuel, n'a pas lieu chaque fois
    // que son jour revient (migration 087).
    const duJour = creneaux.filter(
      (c) =>
        c.jour_semaine === isodow &&
        creneauALieu(
          {
            jour_semaine: c.jour_semaine,
            heure_debut: c.heure_debut,
            heure_fin: c.heure_fin,
            recurrence: c.recurrence as Recurrence,
            premiere_date: c.premiere_date,
          },
          iso,
        ),
    );

    if (bloques.has(iso)) {
      if (duJour.length > 0) joursSautes += 1;
    } else {
      for (const c of duJour) {
        const duree = dureeCreneau(c.heure_debut, c.heure_fin);
        if (duree <= 0) continue;
        if (
          !creneauOuvert({ date: iso, debut: c.heure_debut }, occupes, instant)
        ) {
          continue;
        }
        cibles.push({
          date: iso,
          debut: c.heure_debut,
          fin: c.heure_fin,
          duree,
        });
        heuresOuvertes += duree;
      }
    }
    curseur.setUTCDate(curseur.getUTCDate() + 1);
  }

  // ── L'ordre pédagogique, explicitement ────────────────────────────────
  //
  // `created_at` ne suffit pas : un module entier s'insère en un seul lot, où
  // toutes les lignes partagent l'horodatage de la transaction. L'ordre à
  // l'intérieur d'un module tenait donc à la chance. Il se lit maintenant du
  // référentiel — élément, puis objectif, puis théorique avant pratique
  // (PRD §4.9) — l'horodatage ne départageant plus que les modules entre eux.
  // Un recalcul (§4.9) rejoue la génération sur des lignes dont certaines ont
  // été créées lors d'un passage précédent — la suite d'un bloc scindé. Leur
  // `created_at` est postérieur à celui de leur module : s'en servir tel quel
  // les renverrait en fin de file. Le lot d'un module est donc le plus ancien
  // de ses horodatages, pas celui de la ligne.
  const lotDuModule = new Map<string, string>();
  for (const s of aPlacer) {
    const t = String(s.created_at ?? "");
    const vu = lotDuModule.get(s.module_id);
    if (vu === undefined || t < vu) lotDuModule.set(s.module_id, t);
  }

  const rang = (s: (typeof aPlacer)[number]) => {
    const sp = s.suggestions_pedagogiques as unknown as {
      ordre: number | null;
      elements_competence: {
        lettre: string | null;
        ordre: number | null;
      } | null;
    } | null;
    return {
      lot: lotDuModule.get(s.module_id) ?? String(s.created_at ?? ""),
      lettre: sp?.elements_competence?.lettre ?? "",
      ordreElement: sp?.elements_competence?.ordre ?? 0,
      ordreObjectif: sp?.ordre ?? 0,
      nature: s.nature === "pratique" ? 1 : 0,
    };
  };

  const ordonnees = [...aPlacer].sort((a, b) => {
    const x = rang(a);
    const y = rang(b);
    return (
      x.lot.localeCompare(y.lot) ||
      x.ordreElement - y.ordreElement ||
      x.lettre.localeCompare(y.lettre) ||
      x.ordreObjectif - y.ordreObjectif ||
      x.nature - y.nature
    );
  });

  // ── Le remplissage lui-même, pur et testable à part ────────────────────
  const blocs: BlocContenu[] = ordonnees.map((s) => ({
    seanceId: s.id,
    suggestionId: s.suggestion_pedagogique_id ?? null,
    code: s.objectif_operationnel ?? "",
    nature: (s.nature as "theorique" | "pratique" | null) ?? null,
    duree: Number(s.duree_prevue) || 0,
  }));

  const { seances: remplies, heuresRestantes } = remplirCreneaux(blocs, cibles);

  // ── Les séances déjà préparées ────────────────────────────────────────
  //
  // Une ligne absorbée par la fusion de deux séances est supprimée, et la
  // cascade emporte ce qui s'y rattache. On repère donc d'abord celles qui
  // portent quelque chose, pour qu'elles portent la séance où elles tombent.
  const idsAPlacer = aPlacer.map((s) => s.id);
  const rattaches = await Promise.all(
    (
      [
        "fiches_preparation",
        "supports_seance",
        "presences",
        "remarques_seance",
        "notations_seance",
      ] as const
    ).map((table) =>
      supabase.from(table).select("seance_id").in("seance_id", idsAPlacer),
    ),
  );
  const preparees = new Set<string>();
  for (const res of rattaches) {
    if (res.error) throw new Error(res.error.message);
    for (const l of res.data ?? []) preparees.add(l.seance_id);
  }

  const parId = new Map(aPlacer.map((s) => [s.id, s]));
  const liensDe = (id: string): string[] =>
    (
      (parId.get(id)?.seance_elements_contenu ?? []) as {
        element_contenu_id: string;
      }[]
    ).map((l) => l.element_contenu_id);

  // Le plan des porteurs, calculé entier avant toute écriture : si une séance
  // préparée devait disparaître dans une fusion, on refuse ici, quand rien
  // n'a encore bougé — plutôt qu'au milieu, un calendrier à moitié réécrit.
  {
    const essai = new Set<string>();
    const absorbees = new Set<string>();
    for (const r of remplies) {
      const ids = r.morceaux.map((m) => m.bloc.seanceId);
      const porteur = choisirPorteur(ids, essai, preparees);
      if (porteur) essai.add(porteur);
      for (const id of ids) absorbees.add(id);
    }
    const perdues = [...absorbees].filter(
      (id) => !essai.has(id) && preparees.has(id),
    );
    if (perdues.length > 0) {
      throw new Error(
        "Ce changement fusionnerait deux séances déjà préparées (fiche, support ou appel) en une seule. Rien n'a été modifié : déplacez ou videz l'une des deux, puis recommencez.",
      );
    }
  }

  // Une ligne de séance n'est revendiquée qu'une fois ; une séance préparée
  // passe devant les autres pour porter le créneau où elle tombe.
  const revendiquees = new Set<string>();
  const consommees = new Set<string>();
  let placees = 0;
  let derniereDate: string | null = null;

  for (const r of remplies) {
    const duree = r.morceaux.reduce((t, m) => t + m.duree, 0);
    // L'objectif affiché nomme tout ce que la séance couvre : une séance qui
    // porte deux objectifs doit les montrer tous les deux (PRD §4.9). Composé
    // sans répéter ce que l'intitulé précédent disait déjà — chaque recalcul
    // y ajoutait une nature de plus.
    const objectif = composerIntitule(
      r.morceaux.map((m) => ({ code: m.bloc.code, nature: m.bloc.nature })),
    );

    const premier = r.morceaux[0]!.bloc;
    const modele = parId.get(premier.seanceId)!;

    let cible: string;
    const porteur = choisirPorteur(
      r.morceaux.map((m) => m.bloc.seanceId),
      revendiquees,
      preparees,
    );
    if (porteur) {
      cible = porteur;
      revendiquees.add(cible);
      const { error } = await supabase
        .from("seances")
        .update({
          date: r.creneau.date,
          heure_debut: r.creneau.debut,
          heure_fin: r.creneau.fin,
          duree_prevue: duree,
          objectif_operationnel: objectif,
          updated_at: new Date().toISOString(),
        })
        .eq("id", cible);
      if (error) throw new Error(error.message);
    } else {
      // Suite d'un bloc scindé : le reste ouvre une séance neuve, qui hérite
      // du module et de l'objectif de la partie précédente.
      const { data, error } = await supabase
        .from("seances")
        .insert({
          module_id: modele.module_id,
          date: r.creneau.date,
          heure_debut: r.creneau.debut,
          heure_fin: r.creneau.fin,
          duree_prevue: duree,
          statut: "a_faire",
          nature: modele.nature,
          suggestion_pedagogique_id: modele.suggestion_pedagogique_id,
          contenu_prevu: modele.contenu_prevu,
          objectif_operationnel: objectif,
          est_fad: modele.est_fad,
          lien_teams: modele.lien_teams,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      cible = data.id;

      const { error: errLien } = await supabase
        .from("seance_groupes")
        .insert({ seance_id: cible, groupe_id: groupeId });
      if (errLien) throw new Error(errLien.message);
    }

    // Les éléments de contenu de tous les morceaux rejoignent la séance : le
    // lien séance ↔ éléments est déjà multiple (§4.2bis), une séance à deux
    // objectifs n'est donc pas une exception à traiter à part.
    const elements = [
      ...new Set(r.morceaux.flatMap((m) => liensDe(m.bloc.seanceId))),
    ];
    if (elements.length > 0) {
      const { error } = await supabase.from("seance_elements_contenu").upsert(
        elements.map((e) => ({ seance_id: cible, element_contenu_id: e })),
        { onConflict: "seance_id,element_contenu_id", ignoreDuplicates: true },
      );
      if (error) throw new Error(error.message);
    }

    for (const m of r.morceaux) consommees.add(m.bloc.seanceId);
    placees += 1;
    derniereDate = r.creneau.date;
  }

  // Les lignes dont le contenu a été absorbé par une autre séance n'ont plus
  // de raison d'être : les garder laisserait des séances fantômes sans date.
  const aSupprimer = [...consommees].filter((id) => !revendiquees.has(id));
  if (aSupprimer.length > 0) {
    const { error } = await supabase
      .from("seances")
      .delete()
      .in("id", aSupprimer);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/calendrier");
  revalidatePath(`/groupes/${groupeId}/progression`);
  revalidatePath("/emploi-du-temps");

  return {
    placees,
    heuresRestantes,
    joursSautes,
    derniereDate,
  };
}
