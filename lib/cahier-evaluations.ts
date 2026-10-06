/**
 * Partie II du cahier du formateur : les évaluations.
 *
 * La planification des contrôles continus et des examens de fin de module, puis
 * les notes de chaque stagiaire. Tout est en base — le formateur recopiait les
 * dates et les notes à la main dans Word, pour quarante stagiaires et cinq
 * modules.
 *
 * Séparé de `app/actions/cahier.ts` pour la même raison que le logigramme : un
 * module « use server » ne peut exporter que des fonctions async, et ces calculs
 * — moyennes, mise à l'échelle sur vingt, répartition dans les colonnes CC — se
 * vérifient sans base de données.
 */

import { baremeAttendu, noteSur20 } from "@/lib/controles";
import { libelleFiliere } from "@/lib/filiere";
import { libelleModule } from "@/lib/modules";
import { heures, type LigneAffectation, type LigneGroupe, type LigneSeance } from "@/lib/logigramme";

/** Une ligne du tableau de planification des contrôles continus. */
export type PlanificationCC = {
  module: string;
  filiere: string;
  groupe: string;
  /** Les dates prévues, une par colonne CC. */
  prevues: (string | null)[];
  /** Les dates d'administration, une par colonne CC. */
  realisees: (string | null)[];
};

/** Une ligne du tableau de planification des examens de fin de module. */
export type PlanificationEFM = {
  module: string;
  filiere: string;
  groupe: string;
  /** La date d'envoi des propositions à la commission. */
  dateValidation: string | null;
  datePrevue: string | null;
  dateEffective: string | null;
  /** Le jour où les notes ont été publiées aux stagiaires. */
  dateRestitution: string | null;
};

/** Une ligne du tableau des notes : un stagiaire, dans un module. */
export type NoteStagiaire = {
  /** Numéro d'inscription — le CEF, à défaut le CNE. */
  numeroInscription: string;
  nom: string;
  /** Les notes de contrôle continu, ramenées sur vingt, une par colonne. */
  cc: (number | null)[];
  moyenneCC: number | null;
  /** La note d'EFM, ramenée sur vingt : elle se barème sur quarante. */
  efm: number | null;
  /** 40 % des contrôles continus et 60 % de l'EFM. Rien si l'un manque. */
  moyenneModule: number | null;
  /** L'appréciation qui va avec la moyenne du module. Vide s'il n'y en a pas. */
  appreciation: string;
};

/** Un module, ses heures et les notes de son groupe. */
export type NotesModule = {
  module: string;
  filiere: string;
  groupe: string;
  annee: number | null;
  masseHorairePrevue: number | null;
  masseHoraireRealisee: number | null;
  effectif: number;
  /** Combien de colonnes de contrôle continu dessiner. */
  colonnesCC: number;
  stagiaires: NoteStagiaire[];
};

export type CahierPartieII = {
  controlesContinus: PlanificationCC[];
  examens: PlanificationEFM[];
  notes: NotesModule[];
};


// ── Les formes que rendent les requêtes ──────────────────────────────────

export type LigneControle = {
  id: string;
  groupe_id: string;
  module_id: string;
  type: string;
  date_prevue: string | null;
  date_administration: string | null;
  date_envoi_propositions: string | null;
  bareme_total: number | null;
};

export type LignePassation = {
  controle_id: string;
  stagiaire_id: string | null;
  note: number | null;
  publie_le: string | null;
  /** Le moment où le stagiaire a rendu sa copie. */
  submitted_at: string | null;
};

export type LigneStagiaire = {
  id: string;
  groupe_id: string | null;
  cef: string | null;
  cne: string | null;
  nom: string;
  prenom: string;
};

/*
  Le cahier officiel réserve cinq colonnes de contrôle continu. On n'en dessine
  jamais moins, pour garder sa forme, et davantage si un module en a eu plus :
  mieux vaut un tableau plus large qu'un contrôle qui disparaît du dossier.
*/
const COLONNES_CC_OFFICIELLES = 5;

/*
  La moyenne d'un module : 40 % des contrôles continus, 60 % de l'examen de fin
  de module. Les deux poids sont nommés parce qu'ils viennent d'une règle de la
  Direction et non d'un calcul : le jour où elle change, elle change ici.
*/
const POIDS_CC = 0.4;
const POIDS_EFM = 0.6;

/**
 * La moyenne d'un module.
 *
 * Rien si l'une des deux parts manque. Un module dont l'EFM n'a pas encore eu
 * lieu n'a pas de moyenne, et une moyenne calculée sur la seule part des
 * contrôles continus serait lue comme définitive.
 */
export function moyenneModule(
  moyenneCC: number | null,
  efm: number | null,
): number | null {
  if (moyenneCC === null || efm === null) return null;
  return Math.round((moyenneCC * POIDS_CC + efm * POIDS_EFM) * 100) / 100;
}

/*
  Les sept crans d'appréciation, du plus haut au plus bas, chacun avec le seuil
  qu'il faut atteindre.

  Les cinq premiers sont ceux de l'usage. Les deux derniers manquaient : une note
  sous dix ne valide pas le module, et laisser la case vide aurait fait croire à
  un oubli de saisie plutôt qu'à un échec.
*/
const APPRECIATIONS: [number, string][] = [
  [18, "Excellent"],
  [16, "Très bien"],
  [14, "Bien"],
  [12, "Assez bien"],
  [10, "Passable"],
  [5, "Insuffisant"],
  [0, "Très insuffisant"],
];

/**
 * L'appréciation qui accompagne une note sur vingt.
 *
 * Sans note, pas d'appréciation : la case reste vide, et c'est le formateur qui
 * l'écrira quand la note existera.
 */
export function appreciation(note: number | null): string {
  if (note === null) return "";
  return APPRECIATIONS.find(([seuil]) => note >= seuil)?.[1] ?? "";
}

/** Une note ramenée sur vingt et arrondie au centième, ou rien. */
function sur20(note: number | null, type: string, bareme: number | null): number | null {
  if (note === null) return null;
  const n = Number(note);
  if (!Number.isFinite(n)) return null;
  const total = baremeAttendu(
    type === "EFM" ? "EFM" : type === "TEST" ? "TEST" : "CC",
    bareme,
  );
  return Math.round(noteSur20(n, total) * 100) / 100;
}

/** La moyenne d'une série de notes, ou rien si aucune n'est connue. */
function moyenne(notes: (number | null)[]): number | null {
  const connues = notes.filter((n): n is number => n !== null);
  if (connues.length === 0) return null;
  const somme = connues.reduce((t, n) => t + n, 0);
  return Math.round((somme / connues.length) * 100) / 100;
}

/**
 * Dresse la partie II d'après les contrôles, les passations et les stagiaires.
 *
 * Les contrôles de test sont écartés : ils servent à essayer la plateforme, et
 * n'ont rien à faire dans un document remis à la Direction.
 */
export function evaluations(
  groupes: LigneGroupe[],
  affectations: LigneAffectation[],
  controles: LigneControle[],
  passations: LignePassation[],
  stagiaires: LigneStagiaire[],
  seances: LigneSeance[],
): CahierPartieII {
  const groupeParId = new Map(groupes.map((g) => [g.id, g]));
  const retenus = controles.filter(
    (c) => c.type === "CC" || c.type === "EFM",
  );

  /** Le libellé d'un module, pris sur n'importe laquelle de ses affectations. */
  const nomDuModule = (moduleId: string): string => {
    const a = affectations.find((x) => x.module_id === moduleId);
    return libelleModule(
      a?.modules?.competences?.code_operationnel,
      a?.modules?.nom,
    );
  };

  /*
    Les contrôles d'un même module et d'un même groupe tiennent une ligne du
    tableau. La clé réunit les deux, et l'ordre des colonnes est celui des
    dates : CC1 est le premier passé, comme sur le document officiel.
  */
  const parCouple = new Map<string, LigneControle[]>();
  for (const c of retenus) {
    const cle = `${c.module_id}|${c.groupe_id}`;
    const deja = parCouple.get(cle);
    if (deja) deja.push(c);
    else parCouple.set(cle, [c]);
  }
  for (const liste of parCouple.values()) {
    liste.sort((x, y) =>
      (x.date_prevue ?? x.date_administration ?? "9999").localeCompare(
        y.date_prevue ?? y.date_administration ?? "9999",
      ),
    );
  }

  const couples = [...parCouple.entries()]
    .map(([cle, liste]) => {
      const [moduleId, groupeId] = cle.split("|") as [string, string];
      const g = groupeParId.get(groupeId);
      return {
        moduleId,
        groupeId,
        module: nomDuModule(moduleId),
        filiere: libelleFiliere(g?.specialites?.nom, g?.annee, g?.option_formation),
        groupe: g?.nom ?? "—",
        annee: g?.annee ?? null,
        cc: liste.filter((c) => c.type === "CC"),
        efm: liste.find((c) => c.type === "EFM") ?? null,
      };
    })
    .sort(
      (x, y) =>
        x.module.localeCompare(y.module, "fr") ||
        x.groupe.localeCompare(y.groupe, "fr"),
    );

  // ── Planification des contrôles continus ────────────────────────────────

  /** Le dernier des jours d'un contrôle, pour un champ donné des passations. */
  const dernierJour = (
    controleId: string,
    champ: "publie_le" | "submitted_at",
  ): string | null => {
    const jours = passations
      .filter((p) => p.controle_id === controleId && p[champ])
      .map((p) => p[champ]!.slice(0, 10));
    // Le dernier fait foi : c'est le jour où le groupe entier a rendu, ou reçu
    // sa note.
    return jours.length > 0 ? (jours.sort().at(-1) ?? null) : null;
  };

  /**
   * La date de réalisation d'un contrôle : celle où les copies sont rendues.
   *
   * C'est en général le jour de l'administration, et la base le sait aussi —
   * mais une épreuve donnée à emporter, ou reprise le lendemain par un
   * stagiaire absent, se réalise le jour du rendu. La date d'administration
   * reste le repli quand aucune copie n'a été remise par la plateforme.
   */
  const dateDeRealisation = (c: LigneControle): string | null =>
    dernierJour(c.id, "submitted_at") ?? c.date_administration;

  const controlesContinus: PlanificationCC[] = couples
    .filter((c) => c.cc.length > 0)
    .map((c) => ({
      module: c.module,
      filiere: c.filiere,
      groupe: c.groupe,
      prevues: c.cc.map((x) => x.date_prevue),
      realisees: c.cc.map(dateDeRealisation),
    }));

  // ── Planification des examens de fin de module ──────────────────────────

  const examens: PlanificationEFM[] = couples
    .filter((c) => c.efm !== null)
    .map((c) => ({
      module: c.module,
      filiere: c.filiere,
      groupe: c.groupe,
      dateValidation: c.efm!.date_envoi_propositions,
      datePrevue: c.efm!.date_prevue,
      dateEffective: dateDeRealisation(c.efm!),
      dateRestitution: dernierJour(c.efm!.id, "publie_le"),
    }));

  // ── Les notes ───────────────────────────────────────────────────────────

  /** Les heures réellement faites dans un module, pour un groupe. */
  const realisees = (moduleId: string, groupeId: string): number | null => {
    let total = 0;
    let vu = false;
    for (const s of seances) {
      if (s.module_id !== moduleId) continue;
      if (!s.seance_groupes.some((l) => l.groupe_id === groupeId)) continue;
      const h = heures(s.duree_realisee);
      if (h === null) continue;
      total += h;
      vu = true;
    }
    return vu ? total : null;
  };

  const notePar = new Map<string, LignePassation>();
  for (const p of passations) {
    if (p.stagiaire_id) notePar.set(`${p.controle_id}|${p.stagiaire_id}`, p);
  }

  const notes: NotesModule[] = couples.map((c) => {
    const colonnesCC = Math.max(COLONNES_CC_OFFICIELLES, c.cc.length);
    const duGroupe = stagiaires
      .filter((e) => e.groupe_id === c.groupeId)
      .sort((x, y) =>
        `${x.nom} ${x.prenom}`.localeCompare(`${y.nom} ${y.prenom}`, "fr"),
      );

    const affectation = affectations.find(
      (a) => a.module_id === c.moduleId && a.groupe_id === c.groupeId,
    );

    return {
      module: c.module,
      filiere: c.filiere,
      groupe: c.groupe,
      annee: c.annee,
      masseHorairePrevue: heures(affectation?.masse_horaire_allouee ?? null),
      masseHoraireRealisee: realisees(c.moduleId, c.groupeId),
      effectif: duGroupe.length,
      colonnesCC,
      stagiaires: duGroupe.map((e) => {
        const cc = c.cc.map((x) => {
          const p = notePar.get(`${x.id}|${e.id}`);
          return sur20(p?.note ?? null, x.type, x.bareme_total);
        });
        const pEfm = c.efm ? notePar.get(`${c.efm.id}|${e.id}`) : undefined;
        const moyCC = moyenne(cc);
        const noteEfm = c.efm
          ? sur20(pEfm?.note ?? null, c.efm.type, c.efm.bareme_total)
          : null;
        const moyModule = moyenneModule(moyCC, noteEfm);
        return {
          numeroInscription: e.cef?.trim() || e.cne?.trim() || "",
          nom: `${e.nom} ${e.prenom}`.trim(),
          cc,
          moyenneCC: moyCC,
          efm: noteEfm,
          moyenneModule: moyModule,
          appreciation: appreciation(moyModule),
        };
      }),
    };
  });

  return { controlesContinus, examens, notes };
}
