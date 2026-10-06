/**
 * Le suivi d'un module, groupe par groupe.
 *
 * Une ligne par module et par groupe, et non par module seul : deux groupes
 * n'avancent pas au même rythme, et le formateur fait signer le suivi de chacun.
 *
 * Séparé de `app/actions/cahier.ts` pour la même raison que le logigramme et les
 * évaluations : un module « use server » ne peut exporter que des fonctions
 * async, et c'est ici que se décide ce qui compte comme réalisé — la règle qui
 * laissait le cahier montrer un suivi vide là où la progression montrait un
 * module avancé.
 */

import { libelleFiliere } from "@/lib/filiere";
import { libelleModule } from "@/lib/modules";
import { lireFiche } from "@/lib/fiche";
import { enCanevasOfficiel, type FicheOfficielle } from "@/lib/fiche-officielle";
import {
  heures,
  type LigneAffectation,
  type LigneGroupe,
  type LigneSeance,
} from "@/lib/logigramme";

export type { FicheOfficielle };

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
  /*
    Les fiches de préparation des séances réalisées, dans l'ordre. Le cahier
    officiel les relie derrière le suivi du module : c'est la pièce que la
    Direction lit pour juger la préparation, et elle est obligatoire.
  */
  fiches: FicheOfficielle[];
  module: string;
  filiere: string;
  /** Le groupe suivi : le cahier fait signer un tableau par groupe. */
  groupe: string;
  annee: number | null;
  masseHoraire: number | null;
  objectif: string | null;
  effectif: number;
  seances: SeanceSuivi[];
};

/** Une durée en heures, telle que la fiche la compte : en minutes. */
function minutes(h: number | null): number | null {
  const v = heures(h);
  return v === null ? null : Math.round(v * 60);
}

export function suivisParGroupe(
  lignesGroupes: LigneGroupe[],
  lignesAffectations: LigneAffectation[],
  lignesSeances: LigneSeance[],
  options: {
    /** La masse horaire d'une affectation, telle que le cahier la compte. */
    masse: (a: LigneAffectation) => number | null;
    effectifs: Map<string, number>;
    /** Les absents d'une séance, par identifiant de séance. */
    absents: Map<string, string[]>;
    /** Le contenu de la fiche enregistrée, par identifiant de séance. */
    fiches: Map<string, string>;
  },
): SuiviModule[] {
  const { effectifs, absents: absentsParSeance, fiches: ficheDeLaSeance } =
    options;


  /*
    Une ligne par module et par groupe, et non par module seul : deux groupes
    n'avancent pas au même rythme, et le formateur fait signer le suivi de
    chacun. Une séance miroir appartient à son groupe, sa source au sien : rien
    à dédoublonner une fois le groupe dans la clé.
  */
  type Brouillon = {
    moduleId: string;
    groupeId: string;
    module: string;
    objectif: string | null;
    masse: number | null;
    seances: LigneSeance[];
  };
  const parCouple = new Map<string, Brouillon>();

  for (const a of lignesAffectations) {
    parCouple.set(`${a.module_id}|${a.groupe_id}`, {
      moduleId: a.module_id,
      groupeId: a.groupe_id,
      module: libelleModule(
        a.modules?.competences?.code_operationnel,
        a.modules?.nom,
      ),
      objectif: a.modules?.competences?.enonce_competence ?? null,
      masse: options.masse(a),
      seances: [],
    });
  }

  for (const s of lignesSeances) {
    for (const lien of s.seance_groupes) {
      parCouple.get(`${s.module_id}|${lien.groupe_id}`)?.seances.push(s);
    }
  }

  /** Une durée en heures, telle que la fiche la compte : en minutes. */
  const minutes = (h: number | null): number | null => {
    const v = heures(h);
    return v === null ? null : Math.round(v * 60);
  };

  const suivis: SuiviModule[] = [...parCouple.values()]
    .map((b) => {
      const g = lignesGroupes.find((x) => x.id === b.groupeId);
      const filiere = libelleFiliere(
        g?.specialites?.nom,
        g?.annee,
        g?.option_formation,
      );

      let cumul = 0;
      const seancesSuivi: SeanceSuivi[] = b.seances.map((s, i) => {
        /*
          Une séance est réalisée quand le formateur l'a cochée, et ses heures
          sont celles qu'il a corrigées, à défaut celles prévues. C'est la règle
          de l'écran de progression, et la suivre ici évite que le cahier
          affiche un suivi vide là où la progression montre un module avancé.
        */
        const faite = s.statut === "fait";
        const realisee = faite ? (heures(s.duree_realisee) ?? heures(s.duree_prevue)) : null;
        if (realisee !== null) cumul += realisee;
        return {
          numero: i + 1,
          datePrevue: s.date,
          objectif: s.objectif_operationnel,
          dureePrevue: heures(s.duree_prevue),
          dateRealisee: faite ? s.date : null,
          contenuRealise: s.contenu_realise,
          dureeRealisee: realisee,
          cumul: realisee !== null ? cumul : null,
          absents: absentsParSeance.get(s.id) ?? [],
          aPrevoir: s.a_prevoir_prochaine_seance,
        };
      });

      /*
        Les fiches des séances réalisées, dans l'ordre. Seulement celles-là :
        une fiche de séance à venir n'a pas sa place dans un document qui rend
        compte de ce qui a été fait.

        Le rappel d'une fiche est ce que la séance précédente demandait de
        préparer — c'est précisément ce sur quoi celle-ci revient.
      */
      const faites = b.seances.filter((s) => s.statut === "fait");
      const fiches: FicheOfficielle[] = [];
      faites.forEach((s, i) => {
        const contenu = ficheDeLaSeance.get(s.id);
        if (!contenu) return;
        fiches.push(
          enCanevasOfficiel(lireFiche(contenu, minutes(s.duree_prevue)), {
            date: s.date,
            dureeMinutes: minutes(s.duree_prevue),
            groupe: g?.nom ?? "—",
            filiere,
            annee: g?.annee ?? null,
            module: b.module,
            rappel: faites[i - 1]?.a_prevoir_prochaine_seance ?? null,
            aPrevoir: s.a_prevoir_prochaine_seance,
          }),
        );
      });

      return {
        fiches,
        module: b.module,
        filiere,
        groupe: g?.nom ?? "—",
        annee: g?.annee ?? null,
        masseHoraire: b.masse,
        objectif: b.objectif,
        effectif: effectifs.get(b.groupeId) ?? 0,
        seances: seancesSuivi,
      };
    })
    // Un module sans aucune séance datée n'a rien à suivre : il figure déjà au
    // tableau des modules pris en charge.
    .filter((m) => m.seances.length > 0)
    .sort(
      (x, y) =>
        x.module.localeCompare(y.module, "fr") ||
        x.groupe.localeCompare(y.groupe, "fr"),
    );

  return suivis;
}
