/**
 * Une fiche de préparation, rangée dans le canevas officiel de l'OFPPT.
 *
 * La plateforme écrit les fiches en quatre phases (§4.3ter) : mise en
 * situation, activité, structuration, réinvestissement. Le cahier du formateur
 * attend trois temps — introduction, développement, conclusion — chacun
 * découpé en rubriques imposées. Ce sont deux découpages du même travail, et ce
 * fichier fait la correspondance.
 *
 * Rien n'est inventé ni reformulé : chaque rubrique reçoit ce qu'une phase
 * contient déjà. Une rubrique sans source reste vide, et le formateur la
 * complète à la main — c'est le cas du rappel quand la séance précédente n'a
 * rien laissé à préparer.
 */

import { definitionPhase, type ClePhase, type PhaseFiche } from "@/lib/phases";
import type { Fiche } from "@/lib/fiche";

/** Le contenu d'une rubrique du canevas : des lignes, et une durée. */
export type Rubrique = {
  libelle: string;
  lignes: string[];
  /** Les minutes de la phase d'où elle vient, quand elle en vient d'une seule. */
  minutes: number | null;
};

/** Une fiche telle que le cahier la pose : trois temps, et son identité. */
export type FicheOfficielle = {
  /** Format AAAA-MM-JJ. */
  date: string | null;
  dureeMinutes: number | null;
  groupe: string;
  filiere: string;
  annee: number | null;
  module: string;
  objectifs: string;
  introduction: Rubrique[];
  developpement: Rubrique[];
  /** Ce que porte la colonne de droite du développement. */
  strategies: string[];
  conclusion: Rubrique[];
};

/** Tout ce qu'une phase contient, dans l'ordre où le formateur l'a écrit. */
function contenu(p: PhaseFiche | undefined): string[] {
  if (!p) return [];
  return [...p.instructions, ...p.questions, ...p.points]
    .map((l) => l.trim())
    .filter(Boolean);
}

const phase = (f: Fiche, cle: ClePhase): PhaseFiche | undefined =>
  f.phases.find((p) => p.cle === cle);

/**
 * Le plan de la séance : les quatre phases et leurs minutes.
 *
 * C'est ce que le formateur annonce en introduction, et la plateforme le sait
 * déjà — inutile de le lui faire réécrire.
 */
function plan(f: Fiche): string[] {
  return f.phases
    .filter((p) => p.minutes > 0)
    .map((p) => `${definitionPhase(p.cle).titre} — ${p.minutes} min`);
}

export function enCanevasOfficiel(
  f: Fiche,
  contexte: {
    date: string | null;
    dureeMinutes: number | null;
    groupe: string;
    filiere: string;
    annee: number | null;
    module: string;
    /** Ce que la séance précédente demandait de préparer : c'est le rappel. */
    rappel: string | null;
    /** Ce que celle-ci demande pour la suivante. */
    aPrevoir: string | null;
  },
): FicheOfficielle {
  const miseEnSituation = phase(f, "mise_en_situation");
  const activite = phase(f, "activite");
  const structuration = phase(f, "structuration");
  const reinvestissement = phase(f, "reinvestissement");

  const minutes = (p: PhaseFiche | undefined) => p?.minutes ?? null;

  return {
    date: contexte.date,
    dureeMinutes: contexte.dureeMinutes,
    groupe: contexte.groupe,
    filiere: contexte.filiere,
    annee: contexte.annee,
    module: contexte.module,
    objectifs: f.objectifs.trim(),

    introduction: [
      {
        libelle: "Rappel",
        // Ce que la séance précédente demandait de préparer : c'est exactement
        // ce sur quoi celle-ci revient.
        lignes: contexte.rappel?.trim() ? [contexte.rappel.trim()] : [],
        minutes: null,
      },
      {
        libelle: "Eléments de motivation",
        lignes: contenu(miseEnSituation),
        minutes: minutes(miseEnSituation),
      },
      { libelle: "Plan de la Séance", lignes: plan(f), minutes: null },
    ],

    // L'activité puis la structuration : les stagiaires cherchent, puis on
    // nomme ce qui vient d'être vécu. C'est le développement du cours.
    developpement: [
      {
        libelle: definitionPhase("activite").titre,
        lignes: contenu(activite),
        minutes: minutes(activite),
      },
      {
        libelle: definitionPhase("structuration").titre,
        /*
          Sans ses points : ce sont les notions à nommer, et la conclusion les
          reprend en synthèse. Les laisser ici les faisait paraître deux fois
          sur la même fiche.
        */
        lignes: [
          ...(structuration?.instructions ?? []),
          ...(structuration?.questions ?? []),
        ]
          .map((l) => l.trim())
          .filter(Boolean),
        minutes: minutes(structuration),
      },
    ],

    /*
      Les stratégies pédagogiques : la méthode active de chaque phase, et la
      modalité de la séance. Ce sont les seules réponses de la plateforme à la
      question « comment ».
    */
    strategies: [
      ...f.phases
        .filter((p) => p.methode.trim())
        .map((p) => `${definitionPhase(p.cle).titre} : ${p.methode.trim()}`),
      ...(f.methodeActive.trim() ? [f.methodeActive.trim()] : []),
      ...(f.modalite.trim() ? [f.modalite.trim()] : []),
    ],

    conclusion: [
      {
        libelle: "Synthèse",
        // Les notions nommées pendant la structuration : c'est le résumé
        // récapitulatif que la conclusion demande.
        lignes: structuration?.points.map((l) => l.trim()).filter(Boolean) ?? [],
        minutes: null,
      },
      {
        libelle: "Evaluation",
        lignes: contenu(reinvestissement),
        minutes: minutes(reinvestissement),
      },
      {
        libelle: "Prochaine séance",
        lignes: contexte.aPrevoir?.trim() ? [contexte.aPrevoir.trim()] : [],
        minutes: null,
      },
    ],
  };
}
