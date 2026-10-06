/**
 * Partie I du cahier du formateur : planification et suivi de la formation.
 *
 * Cinq pièces, dans l'ordre du document officiel : les filières et groupes pris
 * en charge, les modules pris en charge, l'emploi du temps, le logigramme, puis
 * le suivi séance par séance de chaque module.
 *
 * Les tableaux sont larges — quatorze colonnes pour le premier — d'où la page
 * couchée. Les deux premiers et le dernier sont remplis depuis la base ; les
 * deux du milieu sont des cadres où le formateur colle un document émargé, et
 * le cahier officiel fait de même.
 *
 * Séparé de `docx-cahier.ts` pour que l'assembleur reste une table des
 * matières lisible, et non trois cents lignes de tableaux.
 */

import { Paragraph, Table, TableCell, TableRow } from "docx";
import {
  BORDURES_TABLEAU,
  COULEURS,
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
import type { CahierPartieI, Logigramme, SuiviModule } from "@/app/actions/cahier";

/** Une pièce du document : un titre, un paragraphe ou un tableau. */
type Bloc = Paragraph | Table;

/** Une date de la base, telle que le cahier l'écrit. */
function jour(iso: string | null): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** Un nombre d'heures, sans décimale inutile : 7,5 et non 7.50. */
function nbHeures(v: number | null): string {
  if (v === null) return "";
  return String(v).replace(".", ",");
}

/** Une ligne de cellules, pour alléger les tableaux qui en comptent beaucoup. */
function ligne(cellules: TableCell[]): TableRow {
  return new TableRow({ children: cellules });
}

// ── A : Filières et groupes pris en charge ────────────────────────────────

/*
  Les dix mois de l'année de formation, dans l'ordre du document officiel —
  septembre à juin. Juillet et août n'y figurent pas : il n'y a pas de groupe à
  compter.
*/
const MOIS = [
  "Sept.",
  "Oct.",
  "Nov.",
  "Déc.",
  "Jan.",
  "Fév.",
  "Mars",
  "Avr.",
  "Mai",
  "Juin",
] as const;

/** La colonne du mois courant, ou -1 hors année de formation. */
function colonneDuMois(aujourdhui: Date): number {
  // Septembre est le mois 8 pour `getMonth`, qui compte depuis zéro.
  const m = aujourdhui.getMonth();
  return m >= 8 ? m - 8 : m <= 5 ? m + 4 : -1;
}

/** Combien de lignes vides laisser pour les groupes pris en charge plus tard. */
const LIGNES_LIBRES = 3;

function filieresEtGroupes(data: CahierPartieI, aujourdhui: Date): Bloc[] {
  const mois = colonneDuMois(aujourdhui);

  const entete1 = new TableRow({
    tableHeader: true,
    children: [
      celluleEntete("Filières", { lignes: 2 }),
      celluleEntete("Année", { lignes: 2 }),
      celluleEntete("Groupe", { lignes: 2 }),
      celluleEntete("Masse horaire annuelle par groupe", { lignes: 2 }),
      celluleEntete("Effectif par mois", { colonnes: MOIS.length }),
    ],
  });

  const entete2 = new TableRow({
    tableHeader: true,
    children: MOIS.map((m) => celluleEntete(m)),
  });

  const corps = data.groupes.map((g, i) =>
    ligne([
      cellule(g.filiere, { alterne: i % 2 === 1 }),
      cellule(g.annee ? String(g.annee) : "", { centre: true, alterne: i % 2 === 1 }),
      cellule(g.nom, { centre: true, alterne: i % 2 === 1 }),
      cellule(nbHeures(g.masseHoraireAnnuelle), { centre: true, alterne: i % 2 === 1 }),
      /*
        Seule la colonne du mois courant est remplie. La base connaît
        l'effectif d'aujourd'hui, pas celui de novembre dernier : inscrire le
        même nombre dans les dix colonnes serait inventer neuf relevés.
      */
      ...MOIS.map((_, c) =>
        cellule(c === mois ? String(g.effectif) : "", {
          centre: true,
          alterne: i % 2 === 1,
        }),
      ),
    ]),
  );

  const libres = Array.from({ length: LIGNES_LIBRES }, () =>
    ligne(
      Array.from({ length: 4 + MOIS.length }, () => cellule("", { vide: true })),
    ),
  );

  return [
    titre3("Filières et groupes pris en charge"),
    tableau({
      width: PLEINE_LARGEUR,
      borders: BORDURES_TABLEAU,
      columnWidths: colonnes(UTILE_COUCHEE, [
        4, 1.2, 1.6, 2.6,
        ...MOIS.map(() => 1),
      ]),
      rows: [entete1, entete2, ...corps, ...libres],
    }),
    emargement(),
  ];
}

// ── B : Modules pris en charge ────────────────────────────────────────────

function modulesPrisEnCharge(data: CahierPartieI): Bloc[] {
  const entete = new TableRow({
    tableHeader: true,
    children: [
      celluleEntete("N°"),
      celluleEntete("Intitulé du module"),
      celluleEntete("Filière"),
      celluleEntete("Groupe"),
      celluleEntete("Masse horaire"),
      celluleEntete("Date début"),
      celluleEntete("Date fin"),
    ],
  });

  const corps = data.modules.map((m, i) =>
    ligne([
      cellule(String(i + 1), { centre: true, alterne: i % 2 === 1 }),
      cellule(m.intitule, { alterne: i % 2 === 1 }),
      cellule(m.filiere, { alterne: i % 2 === 1 }),
      cellule(m.groupe, { centre: true, alterne: i % 2 === 1 }),
      cellule(nbHeures(m.masseHoraire), { centre: true, alterne: i % 2 === 1 }),
      cellule(jour(m.dateDebut), { centre: true, alterne: i % 2 === 1 }),
      cellule(jour(m.dateFin), { centre: true, alterne: i % 2 === 1 }),
    ]),
  );

  const total = data.modules.reduce((s, m) => s + (m.masseHoraire ?? 0), 0);
  const piedTableau = ligne([
    cellule("Total annuel affecté", {
      colonnes: 4,
      gras: true,
      fond: COULEURS.lavis,
    }),
    cellule(nbHeures(total || null), {
      centre: true,
      gras: true,
      fond: COULEURS.lavis,
    }),
    cellule("", { colonnes: 2, fond: COULEURS.lavis }),
  ]);

  return [
    titre3("Modules pris en charge"),
    tableau({
      width: PLEINE_LARGEUR,
      borders: BORDURES_TABLEAU,
      columnWidths: colonnes(UTILE_COUCHEE, [0.8, 6, 2.4, 1.4, 1.4, 1.6, 1.6]),
      rows: [entete, ...corps, piedTableau],
    }),
    emargement(),
  ];
}

// ── C et D : les deux cadres à coller ─────────────────────────────────────

/**
 * Un cadre vide, assez haut pour y coller un document.
 *
 * Le cahier officiel réserve ainsi une page à l'emploi du temps et une au
 * logigramme : ce sont des documents émargés par la Direction, que le formateur
 * colle. La plateforme n'a pas à les refabriquer.
 */
function cadreAColler(consigne: string, hauteurMm: number): Table {
  return tableau({
    width: PLEINE_LARGEUR,
    borders: BORDURES_TABLEAU,
    rows: [
      new TableRow({
        // En vingtièmes de point : le cadre garde sa hauteur même vide.
        height: { value: Math.round(hauteurMm * 56.7), rule: "atLeast" },
        children: [
          cellule(consigne, { centre: true, fond: COULEURS.papier }),
        ],
      }),
    ],
  });
}

// ── C : Le logigramme de la filière ──────────────────────────────────────

/**
 * Le logigramme d'un groupe : les modules en colonnes, les semaines en lignes.
 *
 * Le document officiel réserve une page où coller le logigramme de la filière
 * quand elle en a un, et demande au formateur de l'élaborer sinon. La
 * plateforme connaît les séances programmées — c'est-à-dire la prévision que la
 * Direction valide — et peut donc le dessiner.
 *
 * Les colonnes portent le rang du module dans le programme, de 1 à seize, et
 * une ligne de codes juste en dessous : « N° Modules » seul ne se lit pas.
 */
function unLogigramme(l: Logigramme, anneeScolaire: string | null): Bloc[] {
  const n = l.modules.length;

  const identite = tableau({
    width: PLEINE_LARGEUR,
    borders: BORDURES_TABLEAU,
    columnWidths: colonnes(UTILE_COUCHEE, [2, 1, 1]),
    rows: [
      ligne([
        cellule(`Filière : ${l.filiere}`, { gras: true }),
        cellule(`Année : ${anneeScolaire ?? ""}`, { gras: true }),
        cellule(`Groupe : ${l.groupe}`, { gras: true }),
      ]),
    ],
  });

  if (l.semaines.length === 0) {
    return [
      titre3(`Logigramme — ${l.groupe}`),
      identite,
      paragraphe(
        "Aucune séance programmée pour ce groupe : le logigramme se dessinera dès que l'emploi du temps sera saisi.",
        { italique: true },
      ),
    ];
  }

  const entete = new TableRow({
    tableHeader: true,
    children: [
      celluleEntete("N° Modules"),
      ...l.modules.map((m) => celluleEntete(String(m.numero))),
      celluleEntete("Total"),
    ],
  });

  const codes = new TableRow({
    tableHeader: true,
    children: [
      cellule("Code", { gras: true, fond: COULEURS.lavis }),
      ...l.modules.map((m) =>
        cellule(m.code, { centre: true, fond: COULEURS.lavis }),
      ),
      cellule("", { fond: COULEURS.lavis }),
    ],
  });

  const totalMasse = l.modules.reduce((t, m) => t + (m.masseHoraire ?? 0), 0);
  const masses = ligne([
    cellule("Masse horaire", { gras: true, fond: COULEURS.papier }),
    ...l.modules.map((m) =>
      cellule(nbHeures(m.masseHoraire), { centre: true, fond: COULEURS.papier }),
    ),
    cellule(nbHeures(totalMasse || null), {
      centre: true,
      gras: true,
      fond: COULEURS.papier,
    }),
  ]);

  const semaines = ligne([
    cellule("Semaines", { gras: true, fond: COULEURS.papier }),
    ...l.modules.map((m) =>
      cellule(m.semaines ? String(m.semaines) : "", {
        centre: true,
        fond: COULEURS.papier,
      }),
    ),
    // Le total n'est pas la somme des colonnes : deux modules peuvent occuper
    // la même semaine. C'est le nombre de semaines de formation.
    cellule(String(l.semaines.length), {
      centre: true,
      gras: true,
      fond: COULEURS.papier,
    }),
  ]);

  const lignesSemaines = l.semaines.map((sem, i) =>
    ligne([
      cellule(sem.libelle, { gras: true, alterne: i % 2 === 1 }),
      ...sem.heures.map((h) =>
        cellule(nbHeures(h), { centre: true, alterne: i % 2 === 1 }),
      ),
      cellule(nbHeures(sem.total || null), {
        centre: true,
        gras: true,
        alterne: i % 2 === 1,
      }),
    ]),
  );

  return [
    titre3(`Logigramme — ${l.groupe}`),
    identite,
    tableau({
      width: PLEINE_LARGEUR,
      borders: BORDURES_TABLEAU,
      // La colonne des semaines plus large que les modules, qui ne portent
      // qu'un nombre d'heures.
      columnWidths: colonnes(UTILE_COUCHEE, [2, ...Array(n).fill(1), 1.2]),
      rows: [entete, codes, masses, semaines, ...lignesSemaines],
    }),
    emargement(),
  ];
}

// ── E : Planification et suivi par module ────────────────────────────────

/** L'en-tête d'un module : ce que le formateur recopiait en tête de tableau. */
function enteteModule(m: SuiviModule): Table {
  const anneeCochee = (n: number) => (m.annees.includes(n) ? "Oui" : "");

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
          `Masse horaire du module : ${nbHeures(m.masseHoraire) || "—"} heures`,
          { colonnes: 4 },
        ),
        cellule(`Nombre de séances : ${m.seances.length}`, { colonnes: 2 }),
      ]),
      ligne([
        cellule(`1ère année : ${anneeCochee(1)}`, { colonnes: 2 }),
        cellule(`2ème année : ${anneeCochee(2)}`, { colonnes: 2 }),
        cellule(`Groupe : ${m.groupes || "—"}`),
        cellule(`Nombre de stagiaire : ${m.effectif}`),
      ]),
      ligne([
        cellule(`Objectif du module : ${m.objectif ?? ""}`, { colonnes: 6 }),
      ]),
    ],
  });
}

/** Le tableau prévision / réalisation d'un module. */
function suiviSeances(m: SuiviModule): Table {
  const entete1 = new TableRow({
    tableHeader: true,
    children: [
      celluleEntete("Prévision par séance", { colonnes: 4 }),
      celluleEntete("Réalisation par séance", { colonnes: 5 }),
    ],
  });

  const entete2 = new TableRow({
    tableHeader: true,
    children: [
      celluleEntete("N°", { lignes: 2 }),
      celluleEntete("Date de la séance", { lignes: 2 }),
      celluleEntete("Objectif opérationnel de la séance", { lignes: 2 }),
      celluleEntete("Durée", { lignes: 2 }),
      celluleEntete("Date", { lignes: 2 }),
      celluleEntete("Contenu réalisé", { lignes: 2 }),
      celluleEntete("Durée en heure", { colonnes: 2 }),
      celluleEntete("Stagiaires absents", { lignes: 2 }),
    ],
  });

  const entete3 = new TableRow({
    tableHeader: true,
    children: [celluleEntete("Réalisé"), celluleEntete("Cumul")],
  });

  const corps: TableRow[] = [];
  m.seances.forEach((s, i) => {
    const pair = i % 2 === 1;
    corps.push(
      ligne([
        cellule(String(s.numero), { centre: true, alterne: pair }),
        cellule(jour(s.datePrevue), { centre: true, alterne: pair }),
        cellule(s.objectif ?? "", { alterne: pair }),
        cellule(s.dureePrevue !== null ? `${nbHeures(s.dureePrevue)} heures` : "", {
          centre: true,
          alterne: pair,
        }),
        cellule(jour(s.dateRealisee), { centre: true, alterne: pair }),
        cellule(s.contenuRealise ?? "", { alterne: pair }),
        cellule(nbHeures(s.dureeRealisee), { centre: true, alterne: pair }),
        cellule(nbHeures(s.cumul), { centre: true, alterne: pair }),
        cellule(s.absents.join(", "), { alterne: pair }),
      ]),
    );

    /*
      Ce que les stagiaires doivent préparer occupe sa propre ligne, sous la
      séance, dans la colonne du contenu réalisé — comme dans le cahier
      officiel. Pas de ligne du tout si rien n'a été noté : une ligne vide
      ferait croire à un oubli.
    */
    if (s.aPrevoir?.trim()) {
      corps.push(
        ligne([
          cellule("", { colonnes: 5, alterne: pair }),
          cellule(`À prévoir pour la prochaine séance : ${s.aPrevoir.trim()}`, {
            alterne: pair,
          }),
          cellule("", { colonnes: 3, alterne: pair }),
        ]),
      );
    }
  });

  return tableau({
    width: PLEINE_LARGEUR,
    borders: BORDURES_TABLEAU,
    columnWidths: colonnes(UTILE_COUCHEE, [0.7, 1.5, 4, 1, 1.5, 5, 1, 1, 2.3]),
    rows: [entete1, entete2, entete3, ...corps],
  });
}

// ── L'assemblage de la partie ────────────────────────────────────────────

/**
 * Toute la partie I, prête à être posée dans une section couchée.
 *
 * `aujourdhui` est passé plutôt que lu : c'est ce qui décide dans quelle
 * colonne de mois tombe l'effectif, et une fonction qui lit l'horloge ne se
 * teste pas deux fois de la même façon.
 *
 * `anneeScolaire` vient de la fiche d'établissement : elle figure en tête de
 * chaque logigramme, et la base des séances ne la connaît pas.
 */
export function partieI(
  data: CahierPartieI,
  anneeScolaire: string | null,
  aujourdhui = new Date(),
): Bloc[] {
  const blocs: Bloc[] = [
    titre2("A- Filières, groupes et modules pris en charge"),
    ...filieresEtGroupes(data, aujourdhui),
    ...modulesPrisEnCharge(data),

    titre2("B- Emploi du temps du formateur"),
    cadreAColler(
      "Coller ici votre emploi du temps émargé par le Directeur pédagogique",
      150,
    ),
    emargement(),

    titre2("C- Logigramme de la filière"),
    paragraphe(
      "Établi d'après les séances programmées : les modules en colonnes, à leur rang dans le programme, et les semaines en lignes. Si la filière dispose déjà d'un logigramme validé, il remplace celui-ci.",
    ),
    ...data.logigrammes.flatMap((l) => unLogigramme(l, anneeScolaire)),

    titre2("D- Planification et suivi de la réalisation des modules de formation"),
  ];

  if (data.suivis.length === 0) {
    blocs.push(
      paragraphe(
        "Aucune séance datée sur cette année de formation : le suivi se remplira à mesure que les séances seront programmées.",
        { italique: true },
      ),
    );
    return blocs;
  }

  for (const m of data.suivis) {
    blocs.push(titre3(m.module), enteteModule(m), suiviSeances(m), emargement());
  }

  return blocs;
}
