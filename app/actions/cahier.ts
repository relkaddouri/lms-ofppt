"use server";

import { createClient } from "@/lib/supabase/server";
import { libelleFiliere } from "@/lib/filiere";
import { libelleModule } from "@/lib/modules";
import { getPortee } from "@/app/actions/annees";
import { getMotifs, type MotifHebdomadaire } from "@/app/actions/motifs";
import {
  evaluations,
  type CahierPartieII,
  type LigneControle,
  type LignePassation,
  type LigneStagiaire,
} from "@/lib/cahier-evaluations";
import {
  heures,
  logigrammes,
  type LigneAffectation,
  type LigneGroupe,
  type LigneSeance,
  type Logigramme,
} from "@/lib/logigramme";

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

export type {
  Logigramme,
  LogigrammeModule,
  LogigrammeSemaine,
} from "@/lib/logigramme";
export type {
  CahierPartieII,
  NoteStagiaire,
  NotesModule,
  PlanificationCC,
  PlanificationEFM,
} from "@/lib/cahier-evaluations";

export type CahierPartieI = {
  groupes: GroupePrisEnCharge[];
  modules: ModulePrisEnCharge[];
  suivis: SuiviModule[];
  logigrammes: Logigramme[];
  /*
    Les rythmes hebdomadaires de l'année, du plus récent au plus ancien. Un
    motif n'est pas figé sur l'année : quand il change, le cahier doit montrer
    lequel s'appliquait et quand, d'où la période portée par chacun.
  */
  motifs: MotifHebdomadaire[];
};

/** Tout ce que le cahier tire de la base, en une lecture. */
export type CahierDonnees = {
  partieI: CahierPartieI;
  partieII: CahierPartieII;
};

/*
  Bornes des lectures. Larges, parce qu'une année de formation fait quelques
  centaines de séances et que tronquer donnerait un cahier faux sans le dire ;
  bornes tout de même, pour qu'une base en désordre ne fasse pas tomber la page.
*/
const MAX_SEANCES = 2000;
const MAX_ABSENCES = 4000;
const MAX_STAGIAIRES = 1000;
const MAX_CONTROLES = 500;
const MAX_PASSATIONS = 8000;

const VIDE: CahierDonnees = {
  partieI: { groupes: [], modules: [], suivis: [], logigrammes: [], motifs: [] },
  partieII: { controlesContinus: [], examens: [], notes: [] },
};

export async function getCahierDonnees(): Promise<CahierDonnees> {
  const supabase = await createClient();
  const { groupeIds } = await getPortee();
  if (groupeIds.length === 0) return VIDE;

  const [groupes, affectations, stagiaires, seances, controles, motifs] =
    await Promise.all([
    supabase
      .from("groupes")
      .select("id, nom, annee, option_formation, specialites(nom)")
      .in("id", groupeIds)
      .order("nom"),
    supabase
      .from("groupe_modules")
      .select(
        "groupe_id, module_id, masse_horaire_allouee, modules(nom, competences(code_operationnel, enonce_competence, cycle, rang_cycle))",
      )
      .in("groupe_id", groupeIds),
    /*
      Les stagiaires portent deux rôles dans le cahier : ils comptent dans les
      effectifs, et ils nomment les lignes du tableau des notes. D'où le nom et
      le numéro d'inscription, qui figurent sur le papier.
    */
    supabase
      .from("stagiaires")
      .select("id, groupe_id, cef, cne, nom, prenom")
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
    /*
      Les contrôles de test restent dehors : ils servent à essayer la
      plateforme, et le filtre est posé ici plutôt qu'en mémoire pour ne pas
      faire voyager ce qu'on jette.
    */
    supabase
      .from("controles")
      .select(
        "id, groupe_id, module_id, type, date_prevue, date_administration, date_envoi_propositions, bareme_total",
      )
      .in("groupe_id", groupeIds)
      .in("type", ["CC", "EFM"])
      .limit(MAX_CONTROLES),
    // L'emploi du temps se lit déjà ailleurs, et de la bonne façon : on
    // reprend cette lecture plutôt que d'en écrire une seconde qui divergerait.
    getMotifs(),
  ]);

  for (const r of [groupes, affectations, stagiaires, seances, controles]) {
    if (r.error) throw new Error(r.error.message);
  }

  const lignesControles = (controles.data ?? []) as unknown as LigneControle[];

  /*
    Les copies ne se lisent qu'une fois les contrôles connus : leur nombre borne
    la requête, et sans contrôle il n'y a rien à demander.
  */
  let lignesPassations: LignePassation[] = [];
  if (lignesControles.length > 0) {
    const { data, error } = await supabase
      .from("passations_controle")
      .select("controle_id, stagiaire_id, note, publie_le, submitted_at")
      .in(
        "controle_id",
        lignesControles.map((c) => c.id),
      )
      .limit(MAX_PASSATIONS);
    if (error) throw new Error(error.message);
    lignesPassations = (data ?? []) as unknown as LignePassation[];
  }

  const lignesGroupes = (groupes.data ?? []) as unknown as LigneGroupe[];
  const nomDuGroupe = new Map(lignesGroupes.map((g) => [g.id, g.nom]));

  const lignesStagiaires = (stagiaires.data ?? []) as unknown as LigneStagiaire[];

  const effectifs = new Map<string, number>();
  for (const e of lignesStagiaires) {
    if (!e.groupe_id) continue;
    effectifs.set(e.groupe_id, (effectifs.get(e.groupe_id) ?? 0) + 1);
  }

  const lignesAffectations = (affectations.data ?? []) as unknown as LigneAffectation[];

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
    filiere: libelleFiliere(g.specialites?.nom, g.annee, g.option_formation),
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
    lignesGroupes.map((g) => [
      g.id,
      libelleFiliere(g.specialites?.nom, g.annee, g.option_formation),
    ]),
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
        // Le libellé du premier groupe du module : tous suivent la même filière
        // et la même année, sans quoi ils ne partageraient pas ses séances.
        filiere:
          [...b.groupes]
            .map((n) => lignesGroupes.find((x) => x.nom === n))
            .filter((g) => g !== undefined)
            .map((g) => libelleFiliere(g.specialites?.nom, g.annee, g.option_formation))
            .at(0) ?? "—",
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

  return {
    partieI: {
      groupes: prisEnCharge,
      modules: modulesPrisEnCharge,
      suivis,
      logigrammes: logigrammes(lignesGroupes, lignesAffectations, lignesSeances),
      motifs,
    },
    partieII: evaluations(
      lignesGroupes,
      lignesAffectations,
      lignesControles,
      lignesPassations,
      lignesStagiaires,
      lignesSeances,
    ),
  };
}
