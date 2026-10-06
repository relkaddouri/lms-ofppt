/**
 * Partie II du cahier du formateur : planification et suivi des évaluations.
 *
 * Quatre pièces, dans l'ordre du document officiel : la planification des
 * contrôles continus, celle des examens de fin de module, les notes module par
 * module, puis la fiche d'appréciation des stagiaires.
 *
 * Tous les tableaux sont en page couchée. Le premier compte quatorze colonnes,
 * celui des notes onze ou plus : debout, les noms des stagiaires se briseraient
 * sur trois lignes et les colonnes de notes tiendraient en deux caractères.
 */

import { Paragraph, Table, TableCell, TableRow } from "docx";
import {
  BORDURES_TABLEAU,
  PLEINE_LARGEUR,
  UTILE_COUCHEE,
  cellule,
  celluleEntete,
  colonnes,
  emargement,
  paragraphe,
  tableau,
  titre2,
  titre3,
} from "@/lib/docx-charte";
import type {
  CahierPartieII,
  NotesModule,
  PlanificationCC,
  PlanificationEFM,
} from "@/app/actions/cahier";

type Bloc = Paragraph | Table;

function ligne(cellules: TableCell[]): TableRow {
  return new TableRow({ children: cellules });
}

/** Une date de la base, telle que le cahier l'écrit. */
function jour(iso: string | null): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** Une note sur vingt, à la française et sans décimale inutile. */
function note(v: number | null): string {
  if (v === null) return "";
  return String(Math.round(v * 100) / 100).replace(".", ",");
}

/** Un nombre d'heures, à la française. */
function nbHeures(v: number | null): string {
  if (v === null) return "";
  return String(v).replace(".", ",");
}

/*
  Le cahier officiel réserve cinq colonnes de contrôle continu. On garde ce
  nombre quand les données en demandent moins, et on l'élargit quand un module
  en a eu davantage : un tableau plus large vaut mieux qu'un contrôle absent du
  dossier.
*/
const COLONNES_CC_OFFICIELLES = 5;

/** Combien de colonnes CC dessiner, pour que toutes les lignes s'alignent. */
function largeurCC(lignes: { prevues: unknown[] }[]): number {
  return lignes.reduce(
    (max, l) => Math.max(max, l.prevues.length),
    COLONNES_CC_OFFICIELLES,
  );
}

/** Les cases à remplir à la main, pour qu'une ligne neuve reste possible. */
const LIGNES_LIBRES = 2;

// ── A : Les contrôles continus ────────────────────────────────────────────

function planificationCC(lignes: PlanificationCC[]): Bloc[] {
  const titre = titre2(
    "A- Planification et suivi de la réalisation des contrôles continus (CC)",
    { nouvellePage: true },
  );
  if (lignes.length === 0) {
    return [
      titre,
      paragraphe(
        "Aucun contrôle continu enregistré sur cette année de formation.",
        { italique: true },
      ),
    ];
  }

  const n = largeurCC(lignes);
  const colonnesCC = Array.from({ length: n }, (_, i) => `CC${i + 1}`);

  const entete1 = new TableRow({
    tableHeader: true,
    children: [
      celluleEntete("N°", { lignes: 2 }),
      celluleEntete("Modules", { lignes: 2 }),
      celluleEntete("Filière", { lignes: 2 }),
      celluleEntete("Groupe", { lignes: 2 }),
      celluleEntete("Date prévisionnelle", { colonnes: n }),
      celluleEntete("Date de réalisation", { colonnes: n }),
    ],
  });

  const entete2 = new TableRow({
    tableHeader: true,
    children: [...colonnesCC, ...colonnesCC].map((c) => celluleEntete(c)),
  });

  const corps = lignes.map((l, i) => {
    const pair = i % 2 === 1;
    const colonne = (dates: (string | null)[]) =>
      Array.from({ length: n }, (_, c) =>
        cellule(jour(dates[c] ?? null), { centre: true, alterne: pair }),
      );
    return ligne([
      cellule(String(i + 1), { centre: true, alterne: pair }),
      cellule(l.module, { alterne: pair }),
      cellule(l.filiere, { alterne: pair }),
      cellule(l.groupe, { centre: true, alterne: pair }),
      ...colonne(l.prevues),
      ...colonne(l.realisees),
    ]);
  });

  const libres = Array.from({ length: LIGNES_LIBRES }, () =>
    ligne(Array.from({ length: 4 + 2 * n }, () => cellule("", { vide: true }))),
  );

  return [
    titre,
    tableau({
      width: PLEINE_LARGEUR,
      borders: BORDURES_TABLEAU,
      columnWidths: colonnes(UTILE_COUCHEE, [
        0.7,
        4,
        2,
        1.3,
        ...Array<number>(2 * n).fill(1),
      ]),
      rows: [entete1, entete2, ...corps, ...libres],
    }),
    emargement(),
  ];
}

// ── B : Les examens de fin de module ──────────────────────────────────────

function planificationEFM(lignes: PlanificationEFM[]): Bloc[] {
  const titre = titre2(
    "B- Planification et suivi de la réalisation des examens de fin de modules (EFM)",
    { nouvellePage: true },
  );
  if (lignes.length === 0) {
    return [
      titre,
      paragraphe(
        "Aucun examen de fin de module enregistré sur cette année de formation.",
        { italique: true },
      ),
    ];
  }

  const entete1 = new TableRow({
    tableHeader: true,
    children: [
      celluleEntete("N°", { lignes: 3 }),
      celluleEntete("Modules", { lignes: 3 }),
      celluleEntete("Filière", { lignes: 3 }),
      celluleEntete("Groupe", { lignes: 3 }),
      celluleEntete("Prévision des EFM", { colonnes: 2 }),
      celluleEntete("Réalisation", { colonnes: 3 }),
    ],
  });

  const entete2 = new TableRow({
    tableHeader: true,
    children: [
      celluleEntete("Date validation", { lignes: 2 }),
      celluleEntete("Date prévue de réalisation", { lignes: 2 }),
      celluleEntete("Date effective de réalisation", { lignes: 2 }),
      celluleEntete("Restitution des notes et des copies", { colonnes: 2 }),
    ],
  });

  const entete3 = new TableRow({
    tableHeader: true,
    children: [
      celluleEntete("Date"),
      celluleEntete("Émargement du Directeur pédagogique"),
    ],
  });

  const corps = lignes.map((l, i) => {
    const pair = i % 2 === 1;
    return ligne([
      cellule(String(i + 1), { centre: true, alterne: pair }),
      cellule(l.module, { alterne: pair }),
      cellule(l.filiere, { alterne: pair }),
      cellule(l.groupe, { centre: true, alterne: pair }),
      cellule(jour(l.dateValidation), { centre: true, alterne: pair }),
      cellule(jour(l.datePrevue), { centre: true, alterne: pair }),
      cellule(jour(l.dateEffective), { centre: true, alterne: pair }),
      cellule(jour(l.dateRestitution), { centre: true, alterne: pair }),
      // L'émargement se signe à la main : la colonne reste vide.
      cellule("", { alterne: pair }),
    ]);
  });

  const libres = Array.from({ length: LIGNES_LIBRES }, () =>
    ligne(Array.from({ length: 9 }, () => cellule("", { vide: true }))),
  );

  return [
    titre,
    tableau({
      width: PLEINE_LARGEUR,
      borders: BORDURES_TABLEAU,
      columnWidths: colonnes(UTILE_COUCHEE, [
        0.7, 4, 2, 1.3, 1.6, 1.8, 1.8, 1.4, 2.4,
      ]),
      rows: [entete1, entete2, entete3, ...corps, ...libres],
    }),
    emargement(),
  ];
}

// ── C : Les notes ─────────────────────────────────────────────────────────

/** L'en-tête d'un tableau de notes : le module, ses heures, son groupe. */
function enteteNotes(m: NotesModule): Table {
  const annee = (n: number) => (m.annee === n ? "Oui" : "");
  return tableau({
    width: PLEINE_LARGEUR,
    borders: BORDURES_TABLEAU,
    columnWidths: colonnes(UTILE_COUCHEE, [2, 2, 2, 2, 2, 2]),
    rows: [
      ligne([
        cellule(`Filière : ${m.filiere}`, { colonnes: 4, gras: true }),
        cellule(`Module : ${m.module}`, { colonnes: 2, gras: true }),
      ]),
      ligne([
        cellule(
          `Masse horaire prévue pour ce module : ${nbHeures(m.masseHorairePrevue) || "—"}`,
          { colonnes: 4 },
        ),
        cellule(
          `Masse horaire réalisée : ${nbHeures(m.masseHoraireRealisee) || "—"}`,
          { colonnes: 2 },
        ),
      ]),
      ligne([
        cellule(`1ère année : ${annee(1)}`, { colonnes: 2 }),
        cellule(`2ème année : ${annee(2)}`, { colonnes: 2 }),
        cellule(`Groupe : ${m.groupe}`),
        cellule(`Nombre de stagiaire : ${m.effectif}`),
      ]),
    ],
  });
}

function tableauNotes(m: NotesModule): Table {
  const n = m.colonnesCC;

  const entete1 = new TableRow({
    tableHeader: true,
    children: [
      celluleEntete("N° d'Ins", { lignes: 2 }),
      celluleEntete("Nom et prénom des stagiaires", { lignes: 2 }),
      celluleEntete("Notes des contrôles continus", { colonnes: n }),
      celluleEntete("Moy CC", { lignes: 2 }),
      celluleEntete("Note EFM", { lignes: 2 }),
      celluleEntete("Moy module", { lignes: 2 }),
      celluleEntete("Appréciation", { lignes: 2 }),
    ],
  });

  const entete2 = new TableRow({
    tableHeader: true,
    children: Array.from({ length: n }, (_, i) => celluleEntete(`CC${i + 1}`)),
  });

  const corps = m.stagiaires.map((e, i) => {
    const pair = i % 2 === 1;
    return ligne([
      cellule(e.numeroInscription, { centre: true, alterne: pair }),
      cellule(e.nom, { alterne: pair }),
      ...Array.from({ length: n }, (_, c) =>
        cellule(note(e.cc[c] ?? null), { centre: true, alterne: pair }),
      ),
      cellule(note(e.moyenneCC), { centre: true, alterne: pair }),
      cellule(note(e.efm), { centre: true, alterne: pair }),
      // 40 % des contrôles continus, 60 % de l'EFM. Vide tant que l'EFM n'a
      // pas eu lieu : un module sans examen n'a pas de moyenne.
      cellule(note(e.moyenneModule), {
        centre: true,
        gras: true,
        alterne: pair,
      }),
      cellule(e.appreciation, { centre: true, alterne: pair }),
    ]);
  });

  return tableau({
    width: PLEINE_LARGEUR,
    borders: BORDURES_TABLEAU,
    columnWidths: colonnes(UTILE_COUCHEE, [
      1.2,
      4,
      ...Array<number>(n).fill(0.9),
      1.1,
      1.1,
      1.1,
      3,
    ]),
    rows: [entete1, entete2, ...corps],
  });
}

// ── D : La fiche d'appréciation ───────────────────────────────────────────

/**
 * La fiche d'appréciation d'un module.
 *
 * L'appréciation vient de la moyenne du module, selon les sept crans de l'usage.
 * Les lignes restent aérées : c'est ce que la Direction lit en premier, et le
 * formateur y ajoute souvent une phrase à la main.
 */
function ficheAppreciation(m: NotesModule, nouvellePage: boolean): Bloc[] {
  const entete = new TableRow({
    tableHeader: true,
    children: [
      celluleEntete("N° d'Ins"),
      celluleEntete("Nom et prénom des stagiaires"),
      celluleEntete("Appréciation"),
    ],
  });

  const corps = m.stagiaires.map((e, i) =>
    ligne([
      cellule(e.numeroInscription, { centre: true, alterne: i % 2 === 1 }),
      cellule(e.nom, { alterne: i % 2 === 1 }),
      cellule(e.appreciation, { vide: true, alterne: i % 2 === 1 }),
    ]),
  );

  return [
    titre3(`${m.module} — ${m.groupe}`, { nouvellePage }),
    tableau({
      width: PLEINE_LARGEUR,
      borders: BORDURES_TABLEAU,
      columnWidths: colonnes(UTILE_COUCHEE, [1.2, 4, 7]),
      rows: [entete, ...corps],
    }),
    emargement(),
  ];
}

// ── L'assemblage de la partie ────────────────────────────────────────────

/** Toute la partie II, prête à être posée dans une section couchée. */
export function partieII(data: CahierPartieII): Bloc[] {
  const blocs: Bloc[] = [
    ...planificationCC(data.controlesContinus),
    ...planificationEFM(data.examens),
    titre2("C- Notes des contrôles continus et de l'examen de fin de module", {
      nouvellePage: true,
    }),
  ];

  if (data.notes.length === 0) {
    blocs.push(
      paragraphe(
        "Aucune évaluation enregistrée : les tableaux de notes paraîtront dès le premier contrôle administré.",
        { italique: true },
      ),
    );
    return blocs;
  }

  // Chaque module sur sa page : le premier suit son titre de section, qui vient
  // d'en ouvrir une.
  data.notes.forEach((m, i) => {
    blocs.push(
      titre3(`${m.module} — ${m.groupe}`, { nouvellePage: i > 0 }),
      enteteNotes(m),
      tableauNotes(m),
      emargement(),
    );
  });

  blocs.push(
    titre2("D- Fiche d'appréciation des stagiaires par module", {
      nouvellePage: true,
    }),
  );
  data.notes.forEach((m, i) => blocs.push(...ficheAppreciation(m, i > 0)));

  return blocs;
}
