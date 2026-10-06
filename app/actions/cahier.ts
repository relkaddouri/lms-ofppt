"use server";

import { createClient } from "@/lib/supabase/server";
import { libelleModule } from "@/lib/modules";
import { getPortee } from "@/app/actions/annees";

/**
 * Ce que la plateforme sait remplir dans le cahier du formateur.
 *
 * Le cahier officiel se recopiait à la main : les groupes pris en charge, les
 * modules avec leur masse horaire et leurs dates, puis séance par séance la
 * prévision et la réalisation. Tout cela est déjà en base — c'est le même
 * travail saisi deux fois.
 *
 * Une seule lecture par édition du document, et le document s'édite quelques
 * fois par an : les requêtes peuvent être larges, elles ne sont pas répétées.
 * Elles restent bornées, et ne ramènent que des colonnes qui figurent sur le
 * papier.
 */

/** Une ligne du tableau « Filières et groupes pris en charge ». */
export type GroupePrisEnCharge = {
  filiere: string;
  annee: number | null;
  nom: string;
  /** Somme des masses horaires allouées à ce groupe, tous modules confondus. */
  masseHoraireAnnuelle: number | null;
  /** L'effectif d'aujourd'hui : la base ne garde pas l'historique mensuel. */
  effectif: number;
};

/** Une ligne du tableau « Modules pris en charge ». */
export type ModulePrisEnCharge = {
  intitule: string;
  filiere: string;
  groupe: string;
  masseHoraire: number | null;
  /** Première et dernière séance datées, faute de dates saisies à la main. */
  dateDebut: string | null;
  dateFin: string | null;
};

/** Une ligne du tableau « Prévision / Réalisation » d'un module. */
export type SeanceSuivi = {
  numero: number;
  datePrevue: string | null;
  objectif: string | null;
  dureePrevue: number | null;
  dateRealisee: string | null;
  contenuRealise: string | null;
  dureeRealisee: number | null;
  /** Cumul des heures réalisées depuis le début du module. */
  cumul: number | null;
  absents: string[];
  aPrevoir: string | null;
};

/** Un module et son suivi séance par séance. */
export type SuiviModule = {
  module: string;
  filiere: string;
  /** Les groupes qui suivent ce module, réunis comme sur le document officiel. */
  groupes: string;
  annees: number[];
  masseHoraire: number | null;
  objectif: string | null;
  effectif: number;
  seances: SeanceSuivi[];
};

export type CahierPartieI = {
  groupes: GroupePrisEnCharge[];
  modules: ModulePrisEnCharge[];
  suivis: SuiviModule[];
};

/*
  Bornes des lectures. Larges, parce qu'une année de formation fait quelques
  centaines de séances et que tronquer donnerait un cahier faux sans le dire ;
  bornes tout de même, pour qu'une base en désordre ne fasse pas tomber la page.
*/
const MAX_SEANCES = 2000;
const MAX_ABSENCES = 4000;
const MAX_STAGIAIRES = 1000;

/** Durée en heures telle que la base la stocke : un nombre, ou rien. */
function heures(v: number | string | null): number | null {
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function getCahierPartieI(): Promise<CahierPartieI> {
  const supabase = await createClient();
  const { groupeIds } = await getPortee();
  if (groupeIds.length === 0) return { groupes: [], modules: [], suivis: [] };

  const [groupes, affectations, stagiaires, seances] = await Promise.all([
    supabase
      .from("groupes")
      .select("id, nom, annee, specialites(nom)")
      .in("id", groupeIds)
      .order("nom"),
    supabase
      .from("groupe_modules")
      .select(
        "groupe_id, module_id, masse_horaire_allouee, modules(nom, competences(code_operationnel, enonce_competence))",
      )
      .in("groupe_id", groupeIds),
    /*
      Un seul identifiant de groupe par stagiaire : de quoi compter les
      effectifs sans ramener les fiches. Les comptes par groupe ne s'obtiennent
      pas en une requête `count`, qui ne rend qu'un total.
    */
    supabase
      .from("stagiaires")
      .select("groupe_id")
      .in("groupe_id", groupeIds)
      .eq("est_test", false)
      .limit(MAX_STAGIAIRES),
    supabase
      .from("seances")
      .select(
        "id, contenu_source_id, module_id, date, duree_prevue, duree_realisee, objectif_operationnel, contenu_realise, a_prevoir_prochaine_seance, seance_groupes!inner(groupe_id)",
      )
      .in("seance_groupes.groupe_id", groupeIds)
      .not("date", "is", null)
      .order("date")
      .limit(MAX_SEANCES),
  ]);

  for (const r of [groupes, affectations, stagiaires, seances]) {
    if (r.error) throw new Error(r.error.message);
  }

  type LigneGroupe = {
    id: string;
    nom: string;
    annee: number | null;
    specialites: { nom: string } | null;
  };
  const lignesGroupes = (groupes.data ?? []) as unknown as LigneGroupe[];
  const nomDuGroupe = new Map(lignesGroupes.map((g) => [g.id, g.nom]));

  const effectifs = new Map<string, number>();
  for (const s of (stagiaires.data ?? []) as { groupe_id: string | null }[]) {
    if (!s.groupe_id) continue;
    effectifs.set(s.groupe_id, (effectifs.get(s.groupe_id) ?? 0) + 1);
  }

  type LigneAffectation = {
    groupe_id: string;
    module_id: string;
    masse_horaire_allouee: number | null;
    modules: {
      nom: string;
      competences: {
        code_operationnel: string | null;
        enonce_competence: string | null;
      } | null;
    } | null;
  };
  const lignesAffectations = (affectations.data ?? []) as unknown as LigneAffectation[];

  type LigneSeance = {
    id: string;
    contenu_source_id: string | null;
    module_id: string;
    date: string | null;
    duree_prevue: number | null;
    duree_realisee: number | null;
    objectif_operationnel: string | null;
    contenu_realise: string | null;
    a_prevoir_prochaine_seance: string | null;
    seance_groupes: { groupe_id: string }[];
  };
  const lignesSeances = (seances.data ?? []) as unknown as LigneSeance[];

  // ── Les absents, séance par séance ──────────────────────────────────────

  const absentsParSeance = new Map<string, string[]>();
  if (lignesSeances.length > 0) {
    const { data: absences, error } = await supabase
      .from("presences")
      .select("seance_id, stagiaires(nom, prenom)")
      .in(
        "seance_id",
        lignesSeances.map((s) => s.id),
      )
      .eq("present", false)
      .limit(MAX_ABSENCES);
    if (error) throw new Error(error.message);

    for (const a of (absences ?? []) as unknown as {
      seance_id: string;
      stagiaires: { nom: string; prenom: string } | null;
    }[]) {
      if (!a.stagiaires) continue;
      const qui = `${a.stagiaires.nom} ${a.stagiaires.prenom}`.trim();
      const deja = absentsParSeance.get(a.seance_id);
      if (deja) deja.push(qui);
      else absentsParSeance.set(a.seance_id, [qui]);
    }
  }

  // ── Filières et groupes pris en charge ──────────────────────────────────

  const masseParGroupe = new Map<string, number>();
  for (const a of lignesAffectations) {
    const h = heures(a.masse_horaire_allouee);
    if (h === null) continue;
    masseParGroupe.set(a.groupe_id, (masseParGroupe.get(a.groupe_id) ?? 0) + h);
  }

  const prisEnCharge: GroupePrisEnCharge[] = lignesGroupes.map((g) => ({
    filiere: g.specialites?.nom ?? "—",
    annee: g.annee,
    nom: g.nom,
    masseHoraireAnnuelle: masseParGroupe.get(g.id) ?? null,
    effectif: effectifs.get(g.id) ?? 0,
  }));

  // ── Modules pris en charge ──────────────────────────────────────────────

  /*
    Les dates de début et de fin ne sont pas saisies : ce sont la première et
    la dernière séance datées du module dans ce groupe. C'est ce que le
    formateur recopiait, et la base le sait déjà.
  */
  const bornes = new Map<string, { debut: string; fin: string }>();
  for (const s of lignesSeances) {
    if (!s.date) continue;
    for (const lien of s.seance_groupes) {
      const cle = `${lien.groupe_id}|${s.module_id}`;
      const b = bornes.get(cle);
      if (!b) bornes.set(cle, { debut: s.date, fin: s.date });
      else {
        if (s.date < b.debut) b.debut = s.date;
        if (s.date > b.fin) b.fin = s.date;
      }
    }
  }

  const filiereDuGroupe = new Map(
    lignesGroupes.map((g) => [g.id, g.specialites?.nom ?? "—"]),
  );
  const anneeDuGroupe = new Map(lignesGroupes.map((g) => [g.id, g.annee]));

  const modulesPrisEnCharge: ModulePrisEnCharge[] = lignesAffectations
    .map((a) => {
      const b = bornes.get(`${a.groupe_id}|${a.module_id}`);
      return {
        intitule: libelleModule(
          a.modules?.competences?.code_operationnel,
          a.modules?.nom,
        ),
        filiere: filiereDuGroupe.get(a.groupe_id) ?? "—",
        groupe: nomDuGroupe.get(a.groupe_id) ?? "—",
        masseHoraire: heures(a.masse_horaire_allouee),
        dateDebut: b?.debut ?? null,
        dateFin: b?.fin ?? null,
      };
    })
    .sort(
      (x, y) =>
        x.intitule.localeCompare(y.intitule, "fr") ||
        x.groupe.localeCompare(y.groupe, "fr"),
    );

  // ── Planification et suivi, module par module ───────────────────────────

  /*
    Une séance miroir et sa source sont la même séance de formation, donnée à
    deux groupes (§4.3bis). Le cahier officiel l'inscrit une fois, et nomme les
    deux groupes en tête du tableau : on regroupe donc sur la source.
  */
  type Brouillon = {
    module: string;
    objectif: string | null;
    groupes: Set<string>;
    annees: Set<number>;
    masse: number;
    seances: Map<string, LigneSeance>;
  };
  const parModule = new Map<string, Brouillon>();

  const brouillon = (moduleId: string): Brouillon => {
    const deja = parModule.get(moduleId);
    if (deja) return deja;
    const a = lignesAffectations.find((x) => x.module_id === moduleId);
    const neuf: Brouillon = {
      module: libelleModule(
        a?.modules?.competences?.code_operationnel,
        a?.modules?.nom,
      ),
      objectif: a?.modules?.competences?.enonce_competence ?? null,
      groupes: new Set(),
      annees: new Set(),
      masse: 0,
      seances: new Map(),
    };
    parModule.set(moduleId, neuf);
    return neuf;
  };

  for (const a of lignesAffectations) {
    const b = brouillon(a.module_id);
    const nom = nomDuGroupe.get(a.groupe_id);
    if (nom) b.groupes.add(nom);
    const annee = anneeDuGroupe.get(a.groupe_id);
    if (annee) b.annees.add(annee);
    const h = heures(a.masse_horaire_allouee);
    if (h !== null) b.masse += h;
  }

  for (const s of lignesSeances) {
    const b = brouillon(s.module_id);
    const cle = s.contenu_source_id ?? s.id;
    // La première rencontrée fait foi : la liste est triée par date, donc
    // c'est la séance d'origine et non son miroir reprogrammé.
    if (!b.seances.has(cle)) b.seances.set(cle, s);
  }

  const effectifDesGroupes = (noms: Set<string>): number => {
    let total = 0;
    for (const g of lignesGroupes) {
      if (noms.has(g.nom)) total += effectifs.get(g.id) ?? 0;
    }
    return total;
  };

  const suivis: SuiviModule[] = [...parModule.values()]
    .map((b) => {
      let cumul = 0;
      const seancesSuivi: SeanceSuivi[] = [...b.seances.values()].map((s, i) => {
        const realisee = heures(s.duree_realisee);
        // Le cumul ne compte que ce qui a été fait : une séance à venir ne
        // gonfle pas le total réalisé.
        if (realisee !== null) cumul += realisee;
        return {
          numero: i + 1,
          datePrevue: s.date,
          objectif: s.objectif_operationnel,
          dureePrevue: heures(s.duree_prevue),
          // La base ne garde pas de date de réalisation distincte : une séance
          // dont le contenu réalisé est saisi a eu lieu à sa date.
          dateRealisee: s.contenu_realise ? s.date : null,
          contenuRealise: s.contenu_realise,
          dureeRealisee: realisee,
          cumul: realisee !== null ? cumul : null,
          absents: absentsParSeance.get(s.id) ?? [],
          aPrevoir: s.a_prevoir_prochaine_seance,
        };
      });

      return {
        module: b.module,
        filiere: [...b.groupes]
          .map((n) => {
            const g = lignesGroupes.find((x) => x.nom === n);
            return g?.specialites?.nom ?? null;
          })
          .find((f): f is string => f !== null) ?? "—",
        groupes: [...b.groupes].sort((x, y) => x.localeCompare(y, "fr")).join(" et "),
        annees: [...b.annees].sort(),
        masseHoraire: b.masse || null,
        objectif: b.objectif,
        effectif: effectifDesGroupes(b.groupes),
        seances: seancesSuivi,
      };
    })
    // Un module sans aucune séance datée n'a rien à suivre : il figure déjà au
    // tableau des modules pris en charge.
    .filter((m) => m.seances.length > 0)
    .sort((x, y) => x.module.localeCompare(y.module, "fr"));

  return { groupes: prisEnCharge, modules: modulesPrisEnCharge, suivis };
}
