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

import { Paragraph, Table, TableCell, TableRow, TextRun, VerticalAlign } from "docx";
import {
  BORDURES_TABLEAU,
  COULEURS,
  MARGES_CELLULE,
  PLEINE_LARGEUR,
  POLICES,
  TAILLES,
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
  CahierPartieI,
  FicheOfficielle,
  Logigramme,
  SuiviModule,
} from "@/app/actions/cahier";
import type { Rubrique } from "@/lib/fiche-officielle";
import type { MotifHebdomadaire } from "@/app/actions/motifs";
import { JOURS } from "@/lib/motifs";
import { CRENEAUX_JOUR } from "@/lib/creneaux";
import { libelleRecurrence } from "@/lib/recurrence";

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
    /*
      Pas de saut ici : ce tableau suit le titre de la partie et celui de la
      section. En casser un de plus laissait les deux titres seuls sur une page.
    */
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
    titre3("Modules pris en charge", { nouvellePage: true }),
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

// ── B : L'emploi du temps ────────────────────────────────────────────────

/**
 * Un motif hebdomadaire, dessiné comme à l'écran : les jours en colonnes, les
 * créneaux en lignes, le groupe dans la case.
 *
 * Le cahier officiel réserve une page où coller l'emploi du temps émargé. La
 * plateforme le connaît — c'est lui qui a placé toutes les séances — et le
 * dessine donc, avec sa période de validité : un rythme change en cours
 * d'année, et il faut pouvoir dire lequel s'appliquait quand.
 */
function unMotif(m: MotifHebdomadaire, nouvellePage: boolean): Bloc[] {
  const periode = m.date_fin
    ? `du ${jour(m.date_debut)} au ${jour(m.date_fin)}`
    : `à partir du ${jour(m.date_debut)}`;

  const entete = new TableRow({
    tableHeader: true,
    children: [
      celluleEntete("Horaire"),
      ...JOURS.map((j) => celluleEntete(j.long)),
    ],
  });

  const lignes = CRENEAUX_JOUR.map((c, i) => {
    const cellules = JOURS.map((j) => {
      /*
        Les créneaux du jour qui touchent cette tranche horaire. Un créneau de
        trois heures en recouvre deux : il paraît dans les deux cases, comme à
        l'écran, plutôt que d'être tronqué.
      */
      const ici = m.creneaux.filter(
        (x) =>
          x.jour_semaine === j.valeur &&
          x.heure_debut < c.fin &&
          x.heure_fin > c.debut,
      );
      const texte = ici
        .map((x) => {
          const rythme = libelleRecurrence(x);
          return rythme ? `${x.groupeNom} (${rythme})` : x.groupeNom;
        })
        .join(" · ");
      return cellule(texte, { centre: true, alterne: i % 2 === 1 });
    });

    return ligne([
      cellule(`${c.debut} – ${c.fin}`, {
        centre: true,
        gras: true,
        fond: COULEURS.lavis,
      }),
      ...cellules,
    ]);
  });

  return [
    titre3(`${m.libelle?.trim() || "Rythme hebdomadaire"} — ${periode}`, {
      nouvellePage,
    }),
    tableau({
      width: PLEINE_LARGEUR,
      borders: BORDURES_TABLEAU,
      columnWidths: colonnes(UTILE_COUCHEE, [1.4, ...JOURS.map(() => 1.6)]),
      rows: [entete, ...lignes],
    }),
    emargement(),
  ];
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
function unLogigramme(
  l: Logigramme,
  anneeScolaire: string | null,
  nouvellePage: boolean,
): Bloc[] {
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
      titre3(`Logigramme — ${l.groupe}`, { nouvellePage }),
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
    titre3(`Logigramme — ${l.groupe}`, { nouvellePage }),
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
  const anneeCochee = (n: number) => (m.annee === n ? "Oui" : "");

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
        cellule(`Groupe : ${m.groupe}`),
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

// ── Les fiches de préparation d'un module ────────────────────────────────

/*
  Le canevas officiel, repris du modèle en annexe : six colonnes pour le bloc
  d'identité, trois pour chacun des trois temps — la durée, la zone de contenu,
  et la rubrique à droite. C'est la forme du document officiel, et une fiche
  reliée au cahier doit s'y superposer.
*/
const TEMPS_FICHE = [0.9, 8, 1.9];

/**
 * Un paragraphe par ligne, dans une seule cellule.
 *
 * `titre` ouvre la cellule en semi-gras : dans le développement, le nom de la
 * phase se confondait avec les consignes qui le suivent.
 */
function lignes(contenu: string[], titre?: string): TableCell {
  const ecrire = (texte: string, fort: boolean) =>
    new Paragraph({
      spacing: { before: 20, after: 20 },
      children: [
        new TextRun({
          text: texte,
          font: fort ? POLICES.corpsGras : POLICES.corps,
          size: TAILLES.tableau,
          color: fort ? COULEURS.encre : COULEURS.corps,
        }),
      ],
    });

  if (contenu.length === 0 && !titre) return cellule("", { vide: true });
  return new TableCell({
    verticalAlign: VerticalAlign.TOP,
    margins: MARGES_CELLULE,
    children: [
      ...(titre ? [ecrire(titre, true)] : []),
      ...contenu.map((l) => ecrire(l, false)),
    ],
  });
}

/** Un des trois temps : ses rubriques, une par ligne. */
function tempsDeLaFiche(titre: string, rubriques: Rubrique[]): Table {
  return tableau({
    width: PLEINE_LARGEUR,
    borders: BORDURES_TABLEAU,
    columnWidths: colonnes(UTILE_COUCHEE, TEMPS_FICHE),
    rows: [
      new TableRow({
        tableHeader: true,
        children: [celluleEntete("Durée"), celluleEntete(titre, { colonnes: 2 })],
      }),
      ...rubriques.map((r) =>
        ligne([
          cellule(r.minutes !== null ? `${r.minutes} min` : "", {
            centre: true,
          }),
          lignes(r.lignes),
          cellule(r.libelle, { gras: true }),
        ]),
      ),
    ],
  });
}

/** Une fiche de préparation, dans le canevas officiel. */
function uneFiche(
  f: FicheOfficielle,
  numero: number,
  nouvellePage: boolean,
): Bloc[] {
  const duree =
    f.dureeMinutes !== null
      ? `${nbHeures(Math.round((f.dureeMinutes / 60) * 100) / 100)} heures`
      : "";

  const identite = tableau({
    width: PLEINE_LARGEUR,
    borders: BORDURES_TABLEAU,
    columnWidths: colonnes(UTILE_COUCHEE, [2.4, 1.3, 0.4, 1.3, 0.4, 5.2]),
    rows: [
      ligne([
        cellule(`Durée de la séance : ${duree}`, { colonnes: 5, gras: true }),
        cellule(`Date de la séance : ${jour(f.date)}`, { gras: true }),
      ]),
      /*
        La case à cocher suit son libellé, et ne le précède pas : posée avant,
        la croix de la deuxième année se lisait comme si elle portait sur le
        groupe.
      */
      ligne([
        cellule(`Groupe : ${f.groupe}`, { gras: true }),
        cellule("2ème année", { centre: true }),
        cellule(f.annee === 2 ? "X" : "", { centre: true }),
        cellule("1ère année", { centre: true }),
        cellule(f.annee === 1 ? "X" : "", { centre: true }),
        cellule(`Filière : ${f.filiere}`, { gras: true }),
      ]),
      ligne([cellule(`Module : ${f.module}`, { colonnes: 6, gras: true })]),
      ligne([
        cellule(`Objectifs de la séance : ${f.objectifs}`, { colonnes: 6 }),
      ]),
    ],
  });

  const developpement = tableau({
    width: PLEINE_LARGEUR,
    borders: BORDURES_TABLEAU,
    columnWidths: colonnes(UTILE_COUCHEE, TEMPS_FICHE),
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          celluleEntete("Durée"),
          celluleEntete("Développement"),
          celluleEntete("Stratégies pédagogiques"),
        ],
      }),
      ...f.developpement.map((r, i) =>
        ligne([
          cellule(r.minutes !== null ? `${r.minutes} min` : "", { centre: true }),
          lignes(r.lignes, r.libelle),
          // Les stratégies ne se découpent pas par rubrique : elles tiennent
          // dans la première case, à côté de tout le développement.
          i === 0 ? lignes(f.strategies) : cellule(""),
        ]),
      ),
    ],
  });

  return [
    titre3(`Fiche de préparation n° ${numero} — ${jour(f.date)}`, {
      nouvellePage,
    }),
    identite,
    new Paragraph({ spacing: { after: 120 }, children: [] }),
    tempsDeLaFiche("Introduction", f.introduction),
    new Paragraph({ spacing: { after: 120 }, children: [] }),
    developpement,
    new Paragraph({ spacing: { after: 120 }, children: [] }),
    tempsDeLaFiche("Conclusion", f.conclusion),
  ];
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

    titre2("B- Emploi du temps du formateur", { nouvellePage: true }),
    ...(data.motifs.length > 0
      ? [
          paragraphe(
            "Le rythme hebdomadaire qui place les séances. Un motif par période de validité, du plus récent au plus ancien.",
          ),
          ...data.motifs.flatMap((m, i) => unMotif(m, i > 0)),
        ]
      : [
          cadreAColler(
            "Coller ici votre emploi du temps émargé par le Directeur pédagogique",
            150,
          ),
          emargement(),
        ]),

    titre2("C- Logigramme de la filière", { nouvellePage: true }),
    paragraphe(
      "Établi d'après les séances programmées : les modules en colonnes, à leur rang dans le programme, et les semaines en lignes. Si la filière dispose déjà d'un logigramme validé, il remplace celui-ci.",
    ),
    ...data.logigrammes.flatMap((l, i) => unLogigramme(l, anneeScolaire, i > 0)),

    titre2("D- Planification et suivi de la réalisation des modules de formation", {
      nouvellePage: true,
    }),
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

  data.suivis.forEach((m, i) => {
    blocs.push(
      titre3(`${m.module} — ${m.groupe}`, { nouvellePage: i > 0 }),
      enteteModule(m),
      suiviSeances(m),
      emargement(),
    );
    /*
      Les fiches du module suivent son tableau de suivi, et non toutes ensemble
      à la fin : c'est ainsi que le cahier officiel se relie, et c'est ce qui
      permet de juger la préparation d'un module d'un seul coup.
    */
    if (m.fiches.length > 0) {
      blocs.push(
        titre3(`Fiches de préparation — ${m.module} — ${m.groupe}`, {
          nouvellePage: true,
        }),
        paragraphe(
          `Les ${m.fiches.length} séance${m.fiches.length > 1 ? "s" : ""} réalisée${m.fiches.length > 1 ? "s" : ""} de ce module, dans le canevas officiel.`,
        ),
      );
      m.fiches.forEach((f, n) => blocs.push(...uneFiche(f, n + 1, n > 0)));
    }
  });

  return blocs;
}
