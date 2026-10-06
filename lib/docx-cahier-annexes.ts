/**
 * Les annexes du cahier du formateur.
 *
 * Quatre pièces, dans l'ordre du document officiel : les missions du formateur
 * citées du statut, ce qu'est une fiche préparation, le modèle de fiche
 * préparation, et le modèle de logigramme.
 *
 * Les deux premières sont du texte, repris mot pour mot. Les deux dernières sont
 * des formulaires vierges : le cahier officiel les porte pour que le formateur
 * ait le modèle sous la main, et la plateforme n'a rien à y remplir.
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
  tableau,
  titre2,
} from "@/lib/docx-charte";
import { rendreBlocs } from "@/lib/docx-blocs";
import { FICHE_PREPARATION, MISSIONS_FORMATEUR } from "@/lib/docx-cahier-textes";

type Bloc = Paragraph | Table;

function ligne(cellules: TableCell[]): TableRow {
  return new TableRow({ children: cellules });
}

/**
 * Une case du formulaire, à remplir à la main.
 *
 * `vide` donne au paragraphe sa respiration ; la hauteur d'une ligne, elle, se
 * pose sur la `TableRow` et non sur la cellule.
 */
function aRemplir(): TableCell {
  return cellule("", { vide: true });
}

/** Une hauteur en millimètres, en vingtièmes de point. */
const hauteur = (mm: number) => Math.round(mm * 56.7);

// ── Le modèle de fiche préparation ────────────────────────────────────────

/*
  Six colonnes pour le bloc d'identité, trois pour les trois temps de la séance.
  Les largeurs sont celles du document officiel, ramenées en proportions : dans
  les tableaux de l'introduction, du développement et de la conclusion, la
  colonne étroite porte la durée, la large est la zone d'écriture, et celle de
  droite nomme la rubrique. C'est inhabituel, et c'est la forme officielle.
*/
const TEMPS = [0.9, 8, 1.9];

/** Un des trois temps de la séance : introduction, développement, conclusion. */
function tempsDeSeance(titre: string, rubriques: string[]): Table {
  return tableau({
    width: PLEINE_LARGEUR,
    borders: BORDURES_TABLEAU,
    columnWidths: colonnes(UTILE_COUCHEE, TEMPS),
    rows: [
      new TableRow({
        tableHeader: true,
        children: [celluleEntete("Durée"), celluleEntete(titre, { colonnes: 2 })],
      }),
      ...rubriques.map((r) =>
        new TableRow({
          height: { value: hauteur(14), rule: "atLeast" },
          children: [aRemplir(), aRemplir(), cellule(r, { gras: true })],
        }),
      ),
    ],
  });
}

function modeleFichePreparation(): Bloc[] {
  const identite = tableau({
    width: PLEINE_LARGEUR,
    borders: BORDURES_TABLEAU,
    columnWidths: colonnes(UTILE_COUCHEE, [2.4, 0.3, 1.3, 0.3, 1.3, 5.2]),
    rows: [
      ligne([
        cellule("Durée de la séance :", { colonnes: 5, gras: true }),
        cellule("Date de la séance :", { gras: true }),
      ]),
      ligne([
        cellule("Groupe :", { gras: true }),
        aRemplir(),
        cellule("2ème année", { centre: true }),
        aRemplir(),
        cellule("1ère année", { centre: true }),
        cellule("Filière :", { gras: true }),
      ]),
      ligne([cellule("Module :", { colonnes: 6, gras: true, vide: true })]),
      ligne([
        cellule("Objectifs de la séance :", { colonnes: 6, gras: true, vide: true }),
      ]),
    ],
  });

  return [
    titre2("Modèle de fiche préparation"),
    identite,
    new Paragraph({ spacing: { after: 160 }, children: [] }),
    tempsDeSeance("Introduction", [
      "Rappel",
      "Eléments de motivation",
      "Plan de la Séance",
    ]),
    new Paragraph({ spacing: { after: 160 }, children: [] }),
    // Le développement n'a pas de rubriques imposées : une seule ligne, haute,
    // et la colonne de droite accueille les stratégies pédagogiques.
    tableau({
      width: PLEINE_LARGEUR,
      borders: BORDURES_TABLEAU,
      columnWidths: colonnes(UTILE_COUCHEE, TEMPS),
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            celluleEntete("Durée"),
            celluleEntete("Développement"),
            celluleEntete("Stratégies pédagogiques"),
          ],
        }),
        new TableRow({
          height: { value: hauteur(70), rule: "atLeast" },
          children: [aRemplir(), aRemplir(), aRemplir()],
        }),
      ],
    }),
    new Paragraph({ spacing: { after: 160 }, children: [] }),
    tempsDeSeance("Conclusion", ["Synthèse", "Evaluation", "Prochaine séance"]),
  ];
}

// ── Le modèle de logigramme ───────────────────────────────────────────────

/** Les seize modules que compte le programme d'une filière. */
const MODULES_PROGRAMME = 16;

/** Assez de lignes pour une année de formation, à numéroter à la main. */
const SEMAINES_LIBRES = 24;

/**
 * Le logigramme vierge, tel que le cahier officiel le porte en annexe.
 *
 * La section C du cahier en produit un, rempli depuis les séances programmées.
 * Celui-ci reste parce que l'annexe officielle l'a : il sert quand on prépare
 * une filière dont rien n'est encore saisi.
 */
function modeleLogigramme(): Bloc[] {
  const vides = (n: number) => Array.from({ length: n }, () => aRemplir());

  return [
    titre2("Modèle de logigramme de la filière"),
    tableau({
      width: PLEINE_LARGEUR,
      borders: BORDURES_TABLEAU,
      columnWidths: colonnes(UTILE_COUCHEE, [2, 1, 1]),
      rows: [
        ligne([
          cellule("Filière :", { gras: true }),
          cellule("Année :", { gras: true }),
          cellule("Groupe :", { gras: true }),
        ]),
      ],
    }),
    new Paragraph({ spacing: { after: 120 }, children: [] }),
    tableau({
      width: PLEINE_LARGEUR,
      borders: BORDURES_TABLEAU,
      columnWidths: colonnes(UTILE_COUCHEE, [
        2,
        ...Array<number>(MODULES_PROGRAMME).fill(1),
        1.2,
      ]),
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            celluleEntete("N° Modules"),
            ...Array.from({ length: MODULES_PROGRAMME }, (_, i) =>
              celluleEntete(String(i + 1)),
            ),
            celluleEntete("Total"),
          ],
        }),
        ligne([
          cellule("Masse horaire", { gras: true, fond: COULEURS.papier }),
          ...vides(MODULES_PROGRAMME + 1),
        ]),
        ligne([
          cellule("Semaines", { gras: true, fond: COULEURS.papier }),
          ...vides(MODULES_PROGRAMME + 1),
        ]),
        ...Array.from({ length: SEMAINES_LIBRES }, () =>
          ligne(vides(MODULES_PROGRAMME + 2)),
        ),
      ],
    }),
  ];
}

// ── L'assemblage des annexes ──────────────────────────────────────────────

/**
 * Les deux annexes de texte, qui se lisent sur une page debout.
 *
 * Séparées des modèles parce que les orientations diffèrent, et qu'une
 * orientation se décide par section dans un document Word.
 */
export function annexesTextes(): Bloc[] {
  return [
    titre2("Missions du formateur"),
    ...rendreBlocs(MISSIONS_FORMATEUR),
    titre2("La fiche préparation"),
    ...rendreBlocs(FICHE_PREPARATION),
  ];
}

/** Les deux formulaires vierges, qui demandent la page couchée. */
export function annexesModeles(): Bloc[] {
  return [...modeleFichePreparation(), ...modeleLogigramme()];
}
