/**
 * Le logigramme d'une filière : les modules en colonnes, les semaines en lignes.
 *
 * Séparé de `app/actions/cahier.ts` pour deux raisons. La première est de
 * règle : un module « use server » ne peut exporter que des fonctions async, et
 * ces calculs n'en sont pas. La seconde est qu'ils se vérifient — la
 * numérotation des semaines décide de tout le tableau, et elle doit pouvoir
 * être mise en échec sans base de données.
 */

import { libelleFiliere } from "@/lib/filiere";

/*
  Les formes que rendent les requêtes. Déclarées ici parce que la lecture et
  le logigramme les partagent : Supabase ne type pas les jointures imbriquées,
  et deux déclarations divergeraient au premier ajout de colonne.
*/
export type LigneGroupe = {
  id: string;
  nom: string;
  annee: number | null;
  /** L'option de deuxième année, qui entre dans le nom de la filière. */
  option_formation: string | null;
  specialites: { nom: string } | null;
};

export type LigneAffectation = {
  groupe_id: string;
  module_id: string;
  masse_horaire_allouee: number | null;
  modules: {
    nom: string;
    competences: {
      code_operationnel: string | null;
      enonce_competence: string | null;
      cycle: string | null;
      rang_cycle: number;
    } | null;
  } | null;
};

export type LigneSeance = {
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
/**
 * Le numéro de semaine ISO d'une date.
 *
 * C'est la numérotation du logigramme officiel : vérifié sur le cahier de
 * 2022/2023, où la ligne S5 correspond au 1er février 2023, premier jour du
 * module M106. Les semaines commencent le lundi, et la semaine 1 est celle qui
 * contient le premier jeudi de l'année.
 */
export function semaineIso(iso: string): { annee: number; semaine: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  // On se place sur le jeudi de la semaine : son année est celle de la semaine.
  const jour = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - jour);
  const premier = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const jours = (d.getTime() - premier.getTime()) / 86400000;
  return {
    annee: d.getUTCFullYear(),
    semaine: Math.ceil((jours + 1) / 7),
  };
}
/** Durée en heures telle que la base la stocke : un nombre, ou rien. */
export function heures(v: number | string | null): number | null {
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
/** Une colonne du logigramme : un module de la filière, à son rang. */
export type LogigrammeModule = {
  /** Son rang dans le programme de la filière, de 1 à seize. */
  numero: number;
  /** Son code opérationnel — « M202 », « EGTSI106 ». */
  code: string;
  /** La masse horaire allouée au groupe. */
  masseHoraire: number | null;
  /** Le nombre de semaines sur lesquelles ses séances s'étalent. */
  semaines: number;
};

/** Une ligne du logigramme : une semaine, et les heures de chaque module. */
export type LogigrammeSemaine = {
  /** « S5 », comme le numérote le document officiel : la semaine ISO. */
  libelle: string;
  /** Les heures prévues par module, dans l'ordre des colonnes. */
  heures: (number | null)[];
  total: number;
};

/**
 * Le logigramme d'un groupe, tel que le cahier officiel le dessine.
 *
 * Les colonnes sont les modules dans l'ordre du programme, les lignes les
 * semaines. Le document officiel est une prévision — « la masse horaire
 * hebdomadaire allouée aux différents modules et le nombre de semaines
 * nécessaire pour terminer un module donné » — et les séances programmées de la
 * plateforme sont précisément cette prévision.
 */
export type Logigramme = {
  filiere: string;
  groupe: string;
  modules: LogigrammeModule[];
  semaines: LogigrammeSemaine[];
};
// ── Le logigramme ─────────────────────────────────────────────────────────

/**
 * Le rang d'un module dans le programme de la filière, de 1 à seize.
 *
 * Le programme compte deux cycles de huit modules : le tronc commun, puis la
 * spécialisation. Le logigramme officiel numérote ses colonnes de 1 à 16 d'un
 * bout à l'autre, d'où le décalage de huit pour le second cycle.
 *
 * Un module hors cycle — il en reste en base — ne prend pas de rang : il
 * passera après les autres, et son code le désignera.
 */
function rangProgramme(
  cycle: string | null,
  rang: number | null,
): number | null {
  if (!rang) return null;
  if (cycle === "tronc_commun") return rang;
  if (cycle === "specialisation") return 8 + rang;
  return null;
}

/** Le lundi de la semaine ISO d'une date, en AAAA-MM-JJ. */
function lundiDeLaSemaine(iso: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  const jour = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (jour - 1));
  return d.toISOString().slice(0, 10);
}

/**
 * Dessine un logigramme par groupe, d'après les séances programmées.
 *
 * Les semaines sans séance sont conservées entre la première et la dernière :
 * ce sont les vacances et les semaines d'examens, et le document officiel les
 * laisse paraître — c'est ce qui permet de voir que le rythme est tenable.
 */
export function logigrammes(
  groupes: LigneGroupe[],
  affectations: LigneAffectation[],
  seances: LigneSeance[],
): Logigramme[] {
  return groupes
    .map((g) => {
      const siennes = affectations.filter((a) => a.groupe_id === g.id);

      /*
        Les colonnes : les modules du groupe, dans l'ordre du programme. Ceux
        qui n'ont pas de rang passent après, dans l'ordre de leur code, pour que
        deux éditions du même cahier donnent les mêmes colonnes.
      */
      const colonnes = siennes
        .map((a) => {
          const c = a.modules?.competences;
          return {
            moduleId: a.module_id,
            code:
              c?.code_operationnel?.trim() || a.modules?.nom?.trim() || "Module",
            rang: rangProgramme(c?.cycle ?? null, c?.rang_cycle ?? null),
            masseHoraire: heures(a.masse_horaire_allouee),
          };
        })
        .sort((x, y) => {
          if (x.rang !== null && y.rang !== null) return x.rang - y.rang;
          if (x.rang !== null) return -1;
          if (y.rang !== null) return 1;
          return x.code.localeCompare(y.code, "fr");
        });

      if (colonnes.length === 0) return null;

      const rangDeLaColonne = new Map(colonnes.map((c, i) => [c.moduleId, i]));

      /*
        Les heures prévues, semaine par semaine et module par module. On somme
        les durées prévues : le logigramme est une prévision, et c'est la
        prévision que la Direction valide.
      */
      const parSemaine = new Map<string, number[]>();
      const semainesDuModule = new Map<string, Set<string>>();
      let premier: string | null = null;
      let dernier: string | null = null;

      for (const s of seances) {
        if (!s.date) continue;
        if (!s.seance_groupes.some((l) => l.groupe_id === g.id)) continue;
        const colonne = rangDeLaColonne.get(s.module_id);
        if (colonne === undefined) continue;
        const lundi = lundiDeLaSemaine(s.date);
        if (!lundi) continue;

        const h = heures(s.duree_prevue) ?? 0;
        const ligne =
          parSemaine.get(lundi) ?? new Array<number>(colonnes.length).fill(0);
        ligne[colonne] = (ligne[colonne] ?? 0) + h;
        parSemaine.set(lundi, ligne);

        const vues = semainesDuModule.get(s.module_id) ?? new Set<string>();
        vues.add(lundi);
        semainesDuModule.set(s.module_id, vues);

        if (premier === null || lundi < premier) premier = lundi;
        if (dernier === null || lundi > dernier) dernier = lundi;
      }

      const lignes: LogigrammeSemaine[] = [];
      if (premier && dernier) {
        for (let jour = premier; jour <= dernier; ) {
          const heuresSemaine = parSemaine.get(jour);
          const num = semaineIso(jour);
          lignes.push({
            libelle: num ? `S${num.semaine}` : jour,
            // Une case à zéro reste vide : le document officiel ne porte des
            // chiffres que là où il y a cours.
            heures: colonnes.map((_, i) => {
              const h = heuresSemaine?.[i] ?? 0;
              return h > 0 ? h : null;
            }),
            total: (heuresSemaine ?? []).reduce((t, h) => t + h, 0),
          });
          const suivant = new Date(`${jour}T00:00:00Z`);
          suivant.setUTCDate(suivant.getUTCDate() + 7);
          jour = suivant.toISOString().slice(0, 10);
        }
      }

      return {
        filiere: libelleFiliere(g.specialites?.nom, g.annee, g.option_formation),
        groupe: g.nom,
        modules: colonnes.map((c, i) => ({
          numero: c.rang ?? i + 1,
          code: c.code,
          masseHoraire: c.masseHoraire,
          semaines: semainesDuModule.get(c.moduleId)?.size ?? 0,
        })),
        semaines: lignes,
      };
    })
    .filter((l): l is Logigramme => l !== null);
}

