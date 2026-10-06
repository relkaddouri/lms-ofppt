/**
 * Vérifie le cahier du formateur sur le paquet réellement produit.
 *
 * Pas sur l'intention du code : on ouvre le `.docx`, on lit son XML, et on
 * compte. C'est la seule façon de voir qu'une ligne a disparu d'un tableau ou
 * qu'une date est partie au mauvais format — une relecture du générateur ne le
 * montre pas, et les trois bancs d'essai qui ont menti dans ce projet mentaient
 * tous parce qu'ils comparaient le code à lui-même.
 *
 * Chaque contrôle a été vérifié dans les deux sens : mis en échec sur du code
 * fautif avant d'être accepté sur le bon.
 */

import { readFileSync } from "node:fs";
import JSZip from "jszip";
import type { Etablissement } from "@/app/actions/etablissement";
import type {
  CahierDonnees,
  CahierPartieI,
  CahierPartieII,
} from "@/app/actions/cahier";
import {
  appreciation,
  evaluations,
  moyenneModule,
  type LigneControle,
  type LignePassation,
  type LigneStagiaire,
} from "@/lib/cahier-evaluations";
import {
  logigrammes,
  semaineIso,
  type LigneAffectation,
  type LigneGroupe,
  type LigneSeance,
} from "@/lib/logigramme";
import {
  FICHE_PREPARATION,
  MISSIONS_FORMATEUR,
  PROCEDURES,
} from "@/lib/docx-cahier-textes";

/*
  Le générateur tourne dans le navigateur : il va chercher les polices par
  `fetch("/polices/…")`. En Node il n'y a pas d'origine, donc on les sert depuis
  le disque. Le reste du code n'est pas modifié pour l'essai.
*/
const vraiFetch = globalThis.fetch;
globalThis.fetch = (async (entree: RequestInfo | URL, init?: RequestInit) => {
  const url = String(entree);
  if (url.startsWith("/polices/")) {
    const octets = readFileSync(`public${url}`);
    return new Response(
      new Uint8Array(octets.buffer, octets.byteOffset, octets.byteLength),
    );
  }
  return vraiFetch(entree, init);
}) as typeof fetch;

const { cahierDuFormateur, nomFichierCahier } = await import("@/lib/docx-cahier");

// ── Les deux cas qui comptent ─────────────────────────────────────────────

/** Un formateur dont tout est renseigné. */
const complet: Etablissement = {
  nom: "CMC Souss Massa",
  logo: null,
  nomFormateur: "EL KADDOURI Rachid",
  matricule: "17980",
  codeSecteur: "Pôle DIA",
  niveauFormation: "TS",
  anneeScolaire: "2025/2026",
  directionRegionale: "SOUSS MASSA",
  dateRecrutement: "2021-09-13",
  grade: "Cadre",
  echelon: "01",
  diplome: "Licence professionnelle en informatique décisionnel et statistique",
  specialiteOrigine: "Informatique",
  specialiteAffectation: "Digital Design",
  dateAffectation: "2021-09-13",
  dateDernierBilan: null,
};

/** Un compte neuf : rien de saisi. Le cahier doit sortir quand même. */
const vide: Etablissement = {
  nom: null,
  logo: null,
  nomFormateur: null,
  matricule: null,
  codeSecteur: null,
  niveauFormation: null,
  anneeScolaire: null,
  directionRegionale: null,
  dateRecrutement: null,
  grade: null,
  echelon: null,
  diplome: null,
  specialiteOrigine: null,
  specialiteAffectation: null,
  dateAffectation: null,
  dateDernierBilan: null,
};

/*
  Une partie I réduite mais complète : deux groupes, trois affectations de
  module, et un module suivi sur deux séances — l'une faite avec un absent et
  une consigne pour la suivante, l'autre encore à venir. C'est le minimum qui
  fasse apparaître toutes les colonnes du document officiel.
*/
const partie1: CahierPartieI = {
  groupes: [
    {
      filiere: "Digital Design",
      annee: 2,
      nom: "DES101",
      masseHoraireAnnuelle: 420,
      effectif: 21,
    },
    {
      filiere: "Digital Design",
      annee: 2,
      nom: "DES102",
      masseHoraireAnnuelle: 380,
      effectif: 19,
    },
  ],
  modules: [
    {
      intitule: "M202 — Organiser les données utilisateurs",
      filiere: "Digital Design",
      groupe: "DES101",
      masseHoraire: 55,
      dateDebut: "2025-10-11",
      dateFin: "2025-12-24",
    },
    {
      intitule: "M202 — Organiser les données utilisateurs",
      filiere: "Digital Design",
      groupe: "DES102",
      masseHoraire: 45,
      dateDebut: "2025-10-11",
      dateFin: "2025-12-24",
    },
    {
      intitule: "M204 — Concevoir des interfaces",
      filiere: "Digital Design",
      groupe: "DES101",
      masseHoraire: 80,
      dateDebut: "2026-01-15",
      dateFin: null,
    },
  ],
  suivis: [
    {
      module: "M202 — Organiser les données utilisateurs",
      filiere: "Digital Design",
      groupes: "DES101 et DES102",
      annees: [2],
      masseHoraire: 100,
      objectif: "Organiser les données utilisateurs recueillies en enquête.",
      effectif: 40,
      seances: [
        {
          numero: 1,
          datePrevue: "2025-10-11",
          objectif: "Trier les verbatim par thème",
          dureePrevue: 5,
          dateRealisee: "2025-10-11",
          contenuRealise: "Introduction, tri par affinités",
          dureeRealisee: 5,
          cumul: 5,
          absents: ["FAHMI Khadija"],
          aPrevoir: "Relire les personas",
        },
        {
          numero: 2,
          datePrevue: "2025-10-18",
          objectif: "Construire la carte d'empathie",
          dureePrevue: 2.5,
          dateRealisee: null,
          contenuRealise: null,
          dureeRealisee: null,
          cumul: null,
          absents: [],
          aPrevoir: null,
        },
      ],
    },
  ],
  logigrammes: [
    {
      filiere: "Digital Design",
      groupe: "DES101",
      /*
        Les deux modules se chevauchent sur deux semaines, et une semaine est
        creuse : il faut cela pour que le total des semaines — quatre lignes —
        diffère de la somme des colonnes — trois plus deux. Sans ce décalage, un
        total calculé de travers passerait inaperçu.
      */
      modules: [
        { numero: 2, code: "M202", masseHoraire: 100, semaines: 3 },
        { numero: 4, code: "M204", masseHoraire: 80, semaines: 2 },
      ],
      semaines: [
        { libelle: "S42", heures: [5, null], total: 5 },
        // Une semaine sans cours — vacances — gardée entre les autres.
        { libelle: "S43", heures: [null, null], total: 0 },
        { libelle: "S44", heures: [5, 5], total: 10 },
        { libelle: "S45", heures: [2.5, 5], total: 7.5 },
      ],
    },
  ],
};

/** Un cahier de compte neuf : aucune donnée de partie I. */
const partie1Vide: CahierPartieI = {
  groupes: [],
  modules: [],
  suivis: [],
  logigrammes: [],
};

/*
  La partie II réduite. Deux contrôles continus et un EFM sur un module, et
  trois stagiaires : l'un noté partout, l'un absent au second contrôle, l'un
  sans aucune note. C'est ce qu'il faut pour voir si une case vide reste vide et
  si la moyenne ne compte que les notes connues.
*/
const partie2: CahierPartieII = {
  controlesContinus: [
    {
      module: "M202 — Organiser les données utilisateurs",
      filiere: "Digital Design",
      groupe: "DES101",
      prevues: ["2025-11-17", "2026-01-12"],
      realisees: ["2025-11-17", null],
    },
  ],
  examens: [
    {
      module: "M202 — Organiser les données utilisateurs",
      filiere: "Digital Design",
      groupe: "DES101",
      dateValidation: "2026-01-05",
      datePrevue: "2026-01-26",
      dateEffective: null,
      dateRestitution: null,
    },
  ],
  notes: [
    {
      module: "M202 — Organiser les données utilisateurs",
      filiere: "Digital Design",
      groupe: "DES101",
      annee: 2,
      masseHorairePrevue: 55,
      masseHoraireRealisee: 42.5,
      effectif: 3,
      colonnesCC: 5,
      stagiaires: [
        {
          numeroInscription: "17980001",
          nom: "BENNANI Salma",
          cc: [14, 16],
          moyenneCC: 15,
          efm: 13.5,
          // 0,4 × 15 + 0,6 × 13,5 = 14,1
          moyenneModule: 14.1,
          appreciation: "Bien",
        },
        {
          numeroInscription: "17980002",
          nom: "FAHMI Khadija",
          cc: [12, null],
          moyenneCC: 12,
          efm: null,
          // Sans EFM, pas de moyenne de module, donc pas d'appréciation.
          moyenneModule: null,
          appreciation: "",
        },
        {
          numeroInscription: "17980003",
          nom: "OUAZZANI Imane",
          cc: [null, null],
          moyenneCC: null,
          efm: null,
          moyenneModule: null,
          appreciation: "",
        },
      ],
    },
  ],
};

/** Un compte neuf : aucune évaluation. */
const partie2Vide: CahierPartieII = {
  controlesContinus: [],
  examens: [],
  notes: [],
};

// ── Outils de lecture du paquet ───────────────────────────────────────────

type Paquet = { zip: JSZip; xml: string; texte: string };

const complete: CahierDonnees = { partieI: partie1, partieII: partie2 };
const neuf: CahierDonnees = { partieI: partie1Vide, partieII: partie2Vide };

async function ouvrir(
  e: Etablissement,
  data: CahierDonnees = complete,
  aujourdhui = new Date("2025-10-20T09:00:00Z"),
): Promise<Paquet> {
  const blob = await cahierDuFormateur(e, data, aujourdhui);
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const fichier = zip.file("word/document.xml");
  if (!fichier) throw new Error("word/document.xml absent du paquet");
  const xml = await fichier.async("string");
  // Le texte visible : le contenu des <w:t>, dans l'ordre, sans le balisage.
  const texte = [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
    .map((m) => m[1]!)
    .join(" ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"');
  return { zip, xml, texte };
}

let fautes = 0;
function verifie(nom: string, condition: boolean, detail = "") {
  if (condition) console.log(`✓ ${nom}`);
  else {
    fautes++;
    console.log(`✗ ${nom}${detail ? ` — ${detail}` : ""}`);
  }
}

// ── Les contrôles ─────────────────────────────────────────────────────────

const p = await ouvrir(complet);

// La couverture, telle que l'officiel l'ordonne.
for (const ligne of [
  "Royaume du Maroc",
  "Office de la Formation Professionnelle et de la Promotion du Travail",
  "CAHIER DU FORMATEUR",
  "Partenaire en compétences",
  "Direction Régionale : SOUSS MASSA",
  "Établissement : CMC Souss Massa",
  "Année de formation : 2025/2026",
]) {
  verifie(`Couverture : « ${ligne} »`, p.texte.includes(ligne));
}

// La fiche d'identité : dix lignes, deux colonnes, pas une de moins. Elle ouvre
// le document, donc c'est le premier tableau.
const tableaux = [...p.xml.matchAll(/<w:tbl>[\s\S]*?<\/w:tbl>/g)].map((m) => m[0]);
const identite = tableaux[0] ?? "";
const lignesIdentite = (identite.match(/<w:tr[\s>]/g) ?? []).length;
verifie("Fiche d'identité : dix lignes", lignesIdentite === 10, `${lignesIdentite} lignes`);
const premiereLigne = /<w:tr[\s>][\s\S]*?<\/w:tr>/.exec(identite)?.[0] ?? "";
const colonnesIdentite = (premiereLigne.match(/<w:tc>/g) ?? []).length;
verifie("Fiche d'identité : deux colonnes", colonnesIdentite === 2,
  `${colonnesIdentite} colonnes`);

for (const libelle of [
  "Nom et Prénom",
  "Matricule",
  "Date de recrutement",
  "Grade",
  "Echelon",
  "Diplôme",
  "Spécialité d'origine",
  "Spécialité d'affectation",
  "Date d'affectation",
  "Date du dernier bilan de compétence",
]) {
  verifie(`Fiche d'identité : « ${libelle} »`, p.texte.includes(libelle));
}

// Les dates s'écrivent comme sur le document officiel, et non comme en base.
verifie("Une date sort en JJ/MM/AAAA", p.texte.includes("13/09/2021"));
verifie("Aucune date ne sort au format de la base", !p.texte.includes("2021-09-13"));

// Les procédures, mot pour mot : chacun des blocs doit se retrouver.
const absents = PROCEDURES.filter((b) => !p.texte.includes(b.texte));
verifie(`Procédures : les ${PROCEDURES.length} paragraphes sont là`,
  absents.length === 0,
  absents.length ? `manquent : ${absents.slice(0, 2).map((a) => a.texte.slice(0, 40)).join(" / ")}` : "");

// Les polices du design system voyagent avec le document.
// Les fichiers, pas l'entrée de dossier que JSZip liste aussi.
const fontes = Object.keys(p.zip.files).filter((f) => f.endsWith(".odttf"));
verifie("Quatre polices embarquées", fontes.length === 4, `${fontes.length} trouvées`);
const table = await p.zip.file("word/fontTable.xml")?.async("string");
const embarquees = (table?.match(/<w:embedRegular /g) ?? []).length;
verifie("Chaque police est déclarée embarquée", embarquees === 4, `${embarquees} déclarations`);
for (const famille of ["Sora", "SourceSans3", "SourceSans3 SemiBold", "PlexMono"]) {
  verifie(`Police déclarée : ${famille}`, (table ?? "").includes(`w:name="${famille}"`));
}
// Chaque famille une seule fois : deux fontes sous un même nom et Word retient
// la dernière, ce qui sortait le texte courant en semi-gras.
const familles = [...(table ?? "").matchAll(/<w:font w:name="([^"]+)"/g)].map((m) => m[1]!);
verifie("Aucune famille déclarée deux fois",
  new Set(familles).size === familles.length, familles.join(", "));

// La page : A4 debout, marges de 12 mm (680 vingtièmes de point).
verifie("A4 debout", p.xml.includes('w:w="11906"') && p.xml.includes('w:h="16838"'));
verifie("Marges de 12 mm", /<w:pgMar[^>]*w:left="680"/.test(p.xml));

// Rien d'un gabarit mal rempli ne doit atteindre le papier.
for (const mot of ["undefined", "[object Object]", "NaN"]) {
  verifie(`Le document ne contient pas « ${mot} »`, !p.texte.includes(mot));
}

// ── Partie I ────────────────────────────────────────────────────────────

/** Le texte de chaque cellule d'un tableau, ligne par ligne. */
function grille(tbl: string): string[][] {
  return [...tbl.matchAll(/<w:tr[\s>][\s\S]*?<\/w:tr>/g)].map((tr) =>
    [...tr[0].matchAll(/<w:tc>[\s\S]*?<\/w:tc>/g)].map((tc) =>
      [...tc[0].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
        .map((m) => m[1]!)
        .join("")
        .replace(/&amp;/g, "&")
        .replace(/&apos;/g, "'"),
    ),
  );
}

verifie("Les tableaux de la partie I sont dans une section couchée",
  p.xml.includes('w:orient="landscape"'));
verifie("Une section couchée", p.xml.includes('w:orient="landscape"'));

verifie("Titre de la partie", p.texte.includes("I- Planification et suivi de la formation"));
for (const titre of [
  "Filières et groupes pris en charge",
  "Modules pris en charge",
  "Emploi du temps du formateur",
  "Logigramme de la filière",
  "Planification et suivi de la réalisation des modules de formation",
]) {
  verifie(`Partie I : « ${titre} »`, p.texte.includes(titre));
}
verifie("Les émargements sont là",
  (p.texte.match(/Émargement du Directeur Pédagogique/g) ?? []).length >= 4,
  `${(p.texte.match(/Émargement du Directeur Pédagogique/g) ?? []).length} trouvés`);

// Filières et groupes : les dix mois, et l'effectif dans la seule colonne du
// mois d'édition. Le document est édité un 20 octobre : deuxième colonne.
const groupesTbl = tableaux.map(grille).find((g) => g[0]?.[0] === "Filières") ?? [];
verifie("Les dix mois de l'année de formation",
  ["Sept.", "Oct.", "Nov.", "Déc.", "Jan.", "Fév.", "Mars", "Avr.", "Mai", "Juin"]
    .every((m) => (groupesTbl[1] ?? []).includes(m)),
  (groupesTbl[1] ?? []).join("|"));
const ligneDes101 = groupesTbl.find((l) => l[2] === "DES101") ?? [];
verifie("Un groupe porte sa filière, son année et sa masse horaire",
  ligneDes101[0] === "Digital Design" && ligneDes101[1] === "2" && ligneDes101[3] === "420",
  ligneDes101.join("|"));
verifie("L'effectif tombe dans la colonne du mois d'édition",
  ligneDes101[5] === "21",
  `colonnes de mois : ${ligneDes101.slice(4).join("|")}`);
verifie("Les autres mois restent vides",
  ligneDes101.slice(4).filter((c) => c !== "").length === 1,
  ligneDes101.slice(4).join("|"));

// Modules pris en charge : les lignes, et le total.
const modulesTbl =
  tableaux.map(grille).find((g) => g[0]?.[1] === "Intitulé du module") ?? [];
verifie("Une ligne par module affecté", modulesTbl.length === 1 + partie1.modules.length + 1,
  `${modulesTbl.length} lignes`);
verifie("Les dates sortent en JJ/MM/AAAA",
  (modulesTbl[1] ?? []).includes("11/10/2025"), (modulesTbl[1] ?? []).join("|"));
const totalAttendu = partie1.modules.reduce((t, m) => t + (m.masseHoraire ?? 0), 0);
const piedModules = modulesTbl[modulesTbl.length - 1] ?? [];
verifie("Le total annuel affecté est la somme des masses horaires",
  piedModules[0] === "Total annuel affecté" && piedModules[1] === String(totalAttendu),
  piedModules.join("|"));

// Les deux cadres à coller existent et portent leur consigne.
verifie("Cadre de l'emploi du temps",
  p.texte.includes("Coller ici votre emploi du temps émargé par le Directeur pédagogique"));

// Le suivi du module : l'en-tête, puis une ligne par séance.
verifie("En-tête du module : masse horaire et nombre de séances",
  p.texte.includes("Masse horaire du module : 100 heures") &&
    p.texte.includes("Nombre de séances : 2"));
verifie("En-tête du module : les deux groupes réunis",
  p.texte.includes("Groupe : DES101 et DES102"));
verifie("En-tête du module : l'année cochée",
  p.texte.includes("2ème année : Oui") && p.texte.includes("1ère année : "));
verifie("En-tête du module : l'objectif",
  p.texte.includes("Organiser les données utilisateurs recueillies en enquête."));

const suiviTbl =
  tableaux.map(grille).find((g) => g[0]?.[0] === "Prévision par séance") ?? [];
// Trois lignes d'en-tête, deux séances, et la ligne « à prévoir » de la première.
verifie("Le suivi compte trois en-têtes, deux séances et un « à prévoir »",
  suiviTbl.length === 6, `${suiviTbl.length} lignes`);
const seance1 = suiviTbl[3] ?? [];
verifie("La séance faite porte sa durée réalisée et son cumul",
  seance1[6] === "5" && seance1[7] === "5", seance1.join("|"));
verifie("La séance faite porte son absent", seance1[8] === "FAHMI Khadija", seance1.join("|"));
verifie("La consigne pour la séance suivante est sur sa propre ligne",
  (suiviTbl[4] ?? []).some((c) => c.startsWith("À prévoir pour la prochaine séance :")),
  (suiviTbl[4] ?? []).join("|"));
const seance2 = suiviTbl[5] ?? [];
verifie("Une séance à venir n'a ni durée réalisée ni cumul",
  seance2[6] === "" && seance2[7] === "", seance2.join("|"));
verifie("Une séance à venir n'ajoute pas de ligne « à prévoir »",
  !seance2.some((c) => c.startsWith("À prévoir")), seance2.join("|"));
verifie("Les demi-heures s'écrivent à la française",
  p.texte.includes("2,5 heures") && !p.texte.includes("2.5"));

// ── Le logigramme, d'abord sans base de données ──────────────────────────

/*
  La numérotation des semaines décide de tout le tableau. Les trois premières
  valeurs attendues sont relevées sur le cahier officiel de 2022/2023 : sa ligne
  S5 porte le 1er février 2023, premier jour du module M106, et sa dernière
  ligne utile tombe sur le 8 juin, fin de M108.
*/
for (const [jour, attendu] of [
  ["2023-02-01", 5],
  ["2023-06-08", 23],
  ["2022-10-11", 41],
  // Les deux bords que la règle ISO déplace d'une année sur l'autre.
  ["2021-01-01", 53],
  ["2024-12-30", 1],
] as [string, number][]) {
  const r = semaineIso(jour);
  verifie(`Semaine ISO du ${jour} : S${attendu}`, r?.semaine === attendu,
    r ? `S${r.semaine} (${r.annee})` : "illisible");
}
verifie("Une date illisible ne rend pas de semaine", semaineIso("13/09/2021") === null);

const groupeEssai: LigneGroupe[] = [
  { id: "g1", nom: "DES101", annee: 2, specialites: { nom: "Digital Design" } },
];

const affecte = (
  moduleId: string,
  code: string,
  cycle: string | null,
  rang: number,
  masse: number,
): LigneAffectation => ({
  groupe_id: "g1",
  module_id: moduleId,
  masse_horaire_allouee: masse,
  modules: {
    nom: code,
    competences: {
      code_operationnel: code,
      enonce_competence: null,
      cycle,
      rang_cycle: rang,
    },
  },
});

const programme = (jour: string, moduleId: string, duree: number): LigneSeance => ({
  id: `${moduleId}-${jour}`,
  contenu_source_id: null,
  module_id: moduleId,
  date: jour,
  duree_prevue: duree,
  duree_realisee: null,
  objectif_operationnel: null,
  contenu_realise: null,
  a_prevoir_prochaine_seance: null,
  seance_groupes: [{ groupe_id: "g1" }],
});

/*
  Exprès à contre-sens de l'ordre du programme : la spécialisation est déclarée
  avant le tronc commun, pour voir si le rang remet les colonnes en place.
*/
const dessine = logigrammes(
  groupeEssai,
  [
    affecte("m204", "M204", "specialisation", 4, 80),
    affecte("m102", "M102", "tronc_commun", 2, 55),
  ],
  [
    programme("2025-10-13", "m102", 5),
    programme("2025-10-15", "m102", 2.5),
    // Rien la semaine du 20 : elle doit tout de même paraître.
    programme("2025-10-27", "m204", 5),
  ],
)[0];

verifie("Un logigramme par groupe", dessine !== undefined);
verifie("Les colonnes suivent le rang du programme, pas l'ordre des affectations",
  dessine?.modules.map((m) => m.code).join(",") === "M102,M204",
  dessine?.modules.map((m) => m.code).join(","));
verifie("Le tronc commun garde son rang, la spécialisation décale de huit",
  dessine?.modules.map((m) => m.numero).join(",") === "2,12",
  dessine?.modules.map((m) => m.numero).join(","));
verifie("Les semaines creuses sont conservées entre la première et la dernière",
  dessine?.semaines.map((w) => w.libelle).join(",") === "S42,S43,S44",
  dessine?.semaines.map((w) => w.libelle).join(","));
verifie("Les heures d'une semaine se somment dans la colonne du module",
  dessine?.semaines[0]?.heures[0] === 7.5 && dessine?.semaines[0]?.heures[1] === null,
  JSON.stringify(dessine?.semaines[0]?.heures));
verifie("Une semaine sans cours ne porte aucun chiffre",
  dessine?.semaines[1]?.heures.every((h) => h === null) === true &&
    dessine?.semaines[1]?.total === 0,
  JSON.stringify(dessine?.semaines[1]));
verifie("Le nombre de semaines d'un module compte ses semaines distinctes",
  dessine?.modules[0]?.semaines === 1 && dessine?.modules[1]?.semaines === 1,
  dessine?.modules.map((m) => `${m.code}:${m.semaines}`).join(" "));
verifie("Un groupe sans séance n'a pas de colonnes vides mais pas de lignes",
  logigrammes(groupeEssai, [affecte("m102", "M102", "tronc_commun", 2, 55)], [])[0]
    ?.semaines.length === 0);
verifie("Un groupe sans module n'a pas de logigramme",
  logigrammes(groupeEssai, [], []).length === 0);

// ── Le logigramme, tel qu'il est dessiné ────────────────────────────────

// Repéré par son en-tête et non par son rang : l'ordre des tableaux changera
// au prochain ajout, et un index faux fait échouer un contrôle juste.
const logiTbl = tableaux.map(grille).find((g) => g[0]?.[0] === "N° Modules") ?? [];
verifie("Le logigramme porte filière, année et groupe",
  p.texte.includes("Filière : Digital Design") &&
    p.texte.includes("Année : 2025/2026") &&
    p.texte.includes("Groupe : DES101"));
verifie("Les colonnes sont numérotées puis codées",
  (logiTbl[0] ?? []).join("|") === "N° Modules|2|4|Total" &&
    (logiTbl[1] ?? []).join("|") === "Code|M202|M204|",
  `${(logiTbl[0] ?? []).join("|")} / ${(logiTbl[1] ?? []).join("|")}`);
verifie("La masse horaire et son total",
  (logiTbl[2] ?? []).join("|") === "Masse horaire|100|80|180",
  (logiTbl[2] ?? []).join("|"));
verifie("Le nombre de semaines, dont le total compte les lignes et non les colonnes",
  (logiTbl[3] ?? []).join("|") === "Semaines|3|2|4",
  (logiTbl[3] ?? []).join("|"));
verifie("Une semaine creuse paraît, sans chiffre",
  (logiTbl[5] ?? []).join("|") === "S43|||",
  (logiTbl[5] ?? []).join("|"));
verifie("Les demi-heures du logigramme s'écrivent à la française",
  (logiTbl[7] ?? []).join("|") === "S45|2,5|5|7,5",
  (logiTbl[7] ?? []).join("|"));
verifie("Le cadre vide du logigramme a disparu",
  !p.texte.includes("Coller ici le logigramme"));

// ── Les évaluations, d'abord sans base de données ────────────────────────

/*
  Un module, deux contrôles continus et un EFM, deux stagiaires. Les contrôles
  sont déclarés dans le désordre pour voir si les colonnes se remettent dans
  l'ordre des dates, et l'EFM est barémé sur quarante comme l'exige le §4.7 :
  c'est la mise à l'échelle qui est en jeu.
*/
const essaiControles: LigneControle[] = [
  {
    id: "cc2",
    groupe_id: "g1",
    module_id: "m202",
    type: "CC",
    date_prevue: "2026-01-12",
    date_administration: null,
    date_envoi_propositions: null,
    bareme_total: null,
  },
  {
    id: "cc1",
    groupe_id: "g1",
    module_id: "m202",
    type: "CC",
    date_prevue: "2025-11-17",
    date_administration: "2025-11-18",
    date_envoi_propositions: null,
    bareme_total: null,
  },
  {
    id: "efm",
    groupe_id: "g1",
    module_id: "m202",
    type: "EFM",
    date_prevue: "2026-01-26",
    date_administration: "2026-01-27",
    date_envoi_propositions: "2026-01-05",
    bareme_total: null,
  },
  // Un contrôle d'essai sur le même module : il ne doit pas prendre de colonne.
  {
    id: "test",
    groupe_id: "g1",
    module_id: "m202",
    type: "TEST",
    date_prevue: "2025-10-01",
    date_administration: "2025-10-01",
    date_envoi_propositions: null,
    bareme_total: 10,
  },
  /*
    Et un module qui n'a QUE un essai. C'est le cas qui compte : sans l'écarter
    dès le regroupement, il ouvrirait un tableau de notes sans aucune note, et
    une page du dossier porterait un module jamais évalué.
  */
  {
    id: "test204",
    groupe_id: "g1",
    module_id: "m204",
    type: "TEST",
    date_prevue: "2025-10-02",
    date_administration: "2025-10-02",
    date_envoi_propositions: null,
    bareme_total: 10,
  },
];

const essaiPassations: LignePassation[] = [
  { controle_id: "cc1", stagiaire_id: "s1", note: 14, publie_le: null },
  { controle_id: "cc2", stagiaire_id: "s1", note: 16, publie_le: null },
  // 27 sur quarante : le cahier doit écrire 13,5.
  { controle_id: "efm", stagiaire_id: "s1", note: 27, publie_le: "2026-02-02T10:00:00Z" },
  { controle_id: "cc1", stagiaire_id: "s2", note: 12, publie_le: null },
  // Publiée plus tard : c'est cette date que porte la restitution.
  { controle_id: "efm", stagiaire_id: "s2", note: 20, publie_le: "2026-02-05T10:00:00Z" },
  { controle_id: "test", stagiaire_id: "s1", note: 10, publie_le: null },
];

const essaiStagiaires: LigneStagiaire[] = [
  // Déclarés à l'envers de l'alphabet, pour voir s'ils sont remis en ordre.
  { id: "s2", groupe_id: "g1", cef: "17980002", cne: null, nom: "FAHMI", prenom: "Khadija" },
  { id: "s1", groupe_id: "g1", cef: null, cne: "CNE001", nom: "BENNANI", prenom: "Salma" },
];

const evalEssai = evaluations(
  groupeEssai,
  [
    affecte("m202", "M202", "specialisation", 2, 55),
    affecte("m204", "M204", "specialisation", 4, 80),
  ],
  essaiControles,
  essaiPassations,
  essaiStagiaires,
  [
    { ...programme("2025-11-17", "m202", 5), duree_realisee: 5 },
    { ...programme("2025-11-24", "m202", 5), duree_realisee: 2.5 },
  ],
);

verifie("Les contrôles continus se rangent par date : CC1 est le premier passé",
  evalEssai.controlesContinus[0]?.prevues.join(",") === "2025-11-17,2026-01-12",
  evalEssai.controlesContinus[0]?.prevues.join(","));
verifie("Un contrôle d'essai ne prend pas de colonne",
  evalEssai.controlesContinus[0]?.prevues.length === 2,
  `${evalEssai.controlesContinus[0]?.prevues.length} colonnes`);
verifie("Un module qui n'a qu'un essai n'ouvre pas de tableau de notes",
  evalEssai.notes.length === 1 &&
    evalEssai.notes.every((n) => !n.module.startsWith("M204")),
  evalEssai.notes.map((n) => n.module).join(" / "));
verifie("L'EFM porte sa date de validation et sa date effective",
  evalEssai.examens[0]?.dateValidation === "2026-01-05" &&
    evalEssai.examens[0]?.dateEffective === "2026-01-27",
  JSON.stringify(evalEssai.examens[0]));
verifie("La restitution retient la dernière publication",
  evalEssai.examens[0]?.dateRestitution === "2026-02-05",
  evalEssai.examens[0]?.dateRestitution ?? "aucune");

const noteSalmaCalc = evalEssai.notes[0]?.stagiaires[0];
verifie("Les stagiaires sont remis dans l'ordre alphabétique",
  noteSalmaCalc?.nom === "BENNANI Salma", noteSalmaCalc?.nom);
verifie("Le numéro d'inscription tombe sur le CNE quand le CEF manque",
  noteSalmaCalc?.numeroInscription === "CNE001", noteSalmaCalc?.numeroInscription);
verifie("Une note de contrôle continu reste sur vingt",
  noteSalmaCalc?.cc.join(",") === "14,16", noteSalmaCalc?.cc.join(","));
verifie("Une note d'EFM barémée sur quarante est ramenée sur vingt",
  noteSalmaCalc?.efm === 13.5, String(noteSalmaCalc?.efm));
verifie("La moyenne des contrôles continus", noteSalmaCalc?.moyenneCC === 15,
  String(noteSalmaCalc?.moyenneCC));

const noteKhadijaCalc = evalEssai.notes[0]?.stagiaires[1];
verifie("Une note manquante ne compte pas dans la moyenne",
  noteKhadijaCalc?.cc.join(",") === "12," && noteKhadijaCalc?.moyenneCC === 12,
  `${noteKhadijaCalc?.cc.join(",")} → ${noteKhadijaCalc?.moyenneCC}`);
/*
  La pondération vient de la Direction : 40 % des contrôles continus, 60 % de
  l'examen. Les deux premiers cas sont calculés à la main pour que le contrôle ne
  se contente pas de répéter le code.
*/
for (const [moyCC, efm, attendu] of [
  [15, 13.5, 14.1],
  [9, 12, 10.8],
  [20, 20, 20],
] as [number, number, number][]) {
  verifie(`Moyenne du module : 40 % de ${moyCC} et 60 % de ${efm} font ${attendu}`,
    moyenneModule(moyCC, efm) === attendu, String(moyenneModule(moyCC, efm)));
}
verifie("Sans EFM, le module n'a pas de moyenne", moyenneModule(15, null) === null);
verifie("Sans contrôle continu non plus", moyenneModule(null, 13) === null);

/*
  Les sept crans, pris à leur seuil exact et juste en dessous : c'est là qu'une
  comparaison mal posée se voit.
*/
for (const [note, attendu] of [
  [20, "Excellent"],
  [18, "Excellent"],
  [17.99, "Très bien"],
  [16, "Très bien"],
  [15.99, "Bien"],
  [14, "Bien"],
  [13.99, "Assez bien"],
  [12, "Assez bien"],
  [11.99, "Passable"],
  [10, "Passable"],
  [9.99, "Insuffisant"],
  [5, "Insuffisant"],
  [4.99, "Très insuffisant"],
  [0, "Très insuffisant"],
] as [number, string][]) {
  verifie(`Appréciation de ${note} : ${attendu}`, appreciation(note) === attendu,
    appreciation(note));
}
verifie("Sans note, pas d'appréciation", appreciation(null) === "");

verifie("Le calcul porte la moyenne du module et son appréciation",
  noteSalmaCalc?.moyenneModule === 14.1 && noteSalmaCalc?.appreciation === "Bien",
  `${noteSalmaCalc?.moyenneModule} → ${noteSalmaCalc?.appreciation}`);

verifie("Les heures réalisées du module se somment",
  evalEssai.notes[0]?.masseHoraireRealisee === 7.5,
  String(evalEssai.notes[0]?.masseHoraireRealisee));
verifie("La masse horaire prévue vient de l'affectation",
  evalEssai.notes[0]?.masseHorairePrevue === 55,
  String(evalEssai.notes[0]?.masseHorairePrevue));
verifie("Cinq colonnes de contrôle continu, même avec deux contrôles",
  evalEssai.notes[0]?.colonnesCC === 5, String(evalEssai.notes[0]?.colonnesCC));
verifie("Sans contrôle, il n'y a pas de tableau de notes",
  evaluations(groupeEssai, [], [], [], essaiStagiaires, []).notes.length === 0);

// ── Partie II ───────────────────────────────────────────────────────────

verifie("Titre de la partie II",
  p.texte.includes("II- Planification et suivi des évaluations"));
for (const titre of [
  "Planification et suivi de la réalisation des contrôles continus (CC)",
  "Planification et suivi de la réalisation des examens de fin de modules (EFM)",
  "Notes des contrôles continus et de l'examen de fin de module",
  "Fiche d'appréciation des stagiaires par module",
]) {
  verifie(`Partie II : « ${titre} »`, p.texte.includes(titre));
}

// Les contrôles continus : cinq colonnes même avec deux contrôles, en double —
// prévision et réalisation.
/*
  Les quatre premières cellules de la deuxième ligne d'en-tête sont les
  continuations de fusion verticale de « N° », « Modules », « Filière » et
  « Groupe » : Word les écrit vides, et on les passe.
*/
const ccTbl =
  tableaux.map(grille).find((g) => g[0]?.includes("Date prévisionnelle")) ?? [];
verifie("Cinq colonnes CC en prévision et cinq en réalisation",
  (ccTbl[1] ?? []).slice(4).join("|") === "CC1|CC2|CC3|CC4|CC5|CC1|CC2|CC3|CC4|CC5",
  (ccTbl[1] ?? []).join("|"));
const ligneCC = ccTbl[2] ?? [];
verifie("La date prévue et la date réalisée tombent dans la bonne colonne",
  ligneCC[4] === "17/11/2025" && ligneCC[5] === "12/01/2026" && ligneCC[9] === "17/11/2025",
  ligneCC.join("|"));
verifie("Un contrôle non encore passé laisse sa date de réalisation vide",
  ligneCC[10] === "", ligneCC.join("|"));

// Les examens : trois lignes d'en-tête, et la colonne d'émargement vide.
const efmTbl =
  tableaux.map(grille).find((g) => g[0]?.includes("Prévision des EFM")) ?? [];
verifie("L'en-tête des EFM tient sur trois lignes",
  (efmTbl[2] ?? []).slice(-2).join("|") ===
    "Date|Émargement du Directeur pédagogique",
  (efmTbl[2] ?? []).join("|"));
const ligneEFM = efmTbl[3] ?? [];
verifie("Les dates de l'EFM sont à leur place",
  ligneEFM[4] === "05/01/2026" && ligneEFM[5] === "26/01/2026" && ligneEFM[6] === "",
  ligneEFM.join("|"));

// Les notes : l'en-tête du module, puis une ligne par stagiaire.
verifie("L'en-tête des notes porte les deux masses horaires",
  p.texte.includes("Masse horaire prévue pour ce module : 55") &&
    p.texte.includes("Masse horaire réalisée : 42,5"));

const notesTbl = tableaux.map(grille).find((g) => g[0]?.[0] === "N° d'Ins") ?? [];
verifie("Les colonnes des notes suivent le document officiel",
  (notesTbl[0] ?? []).join("|") ===
    "N° d'Ins|Nom et prénom des stagiaires|Notes des contrôles continus|Moy CC|Note EFM|Moy module|Appréciation",
  (notesTbl[0] ?? []).join("|"));
verifie("Une ligne par stagiaire", notesTbl.length === 2 + 3, `${notesTbl.length} lignes`);
const noteSalma = notesTbl[2] ?? [];
verifie("Les notes et la moyenne du premier stagiaire",
  noteSalma[2] === "14" && noteSalma[3] === "16" && noteSalma[7] === "15" &&
    noteSalma[8] === "13,5",
  noteSalma.join("|"));
verifie("Les colonnes CC non utilisées restent vides",
  noteSalma[4] === "" && noteSalma[5] === "" && noteSalma[6] === "",
  noteSalma.join("|"));
verifie("La moyenne du module et son appréciation sont écrites",
  noteSalma[9] === "14,1" && noteSalma[10] === "Bien", noteSalma.join("|"));
const noteKhadija = notesTbl[3] ?? [];
verifie("Une note manquante ne fausse pas la moyenne",
  noteKhadija[3] === "" && noteKhadija[7] === "12", noteKhadija.join("|"));
const noteImane = notesTbl[4] ?? [];
verifie("Un stagiaire sans note n'a pas de moyenne",
  noteImane[7] === "" && noteImane[8] === "", noteImane.join("|"));
verifie("Sans EFM, la moyenne du module et l'appréciation restent vides",
  noteKhadija[9] === "" && noteKhadija[10] === "", noteKhadija.join("|"));

// La fiche d'appréciation : les noms, et de la place pour écrire.
const apprecTbl =
  tableaux.map(grille).find((g) => g[0]?.[2] === "Appréciation" && g[0].length === 3) ?? [];
verifie("La fiche d'appréciation porte trois colonnes",
  (apprecTbl[0] ?? []).join("|") ===
    "N° d'Ins|Nom et prénom des stagiaires|Appréciation",
  (apprecTbl[0] ?? []).join("|"));
verifie("Elle porte l'appréciation tirée de la moyenne du module",
  (apprecTbl[1] ?? [])[1] === "BENNANI Salma" && (apprecTbl[1] ?? [])[2] === "Bien",
  (apprecTbl[1] ?? []).join("|"));
verifie("Et laisse la case libre quand il n'y a pas encore de moyenne",
  (apprecTbl[2] ?? [])[1] === "FAHMI Khadija" && (apprecTbl[2] ?? [])[2] === "",
  (apprecTbl[2] ?? []).join("|"));

// ── Les annexes ─────────────────────────────────────────────────────────

verifie("La page des annexes", p.texte.includes("Annexes"));
for (const titre of [
  "Missions du formateur",
  "La fiche préparation",
  "Modèle de fiche préparation",
  "Modèle de logigramme de la filière",
]) {
  verifie(`Annexes : « ${titre} »`, p.texte.includes(titre));
}

// Les deux textes officiels, mot pour mot comme les procédures.
for (const [nom, blocs] of [
  ["Missions du formateur", MISSIONS_FORMATEUR],
  ["La fiche préparation", FICHE_PREPARATION],
] as [string, typeof PROCEDURES][]) {
  const absents = blocs.filter((b) => !p.texte.includes(b.texte));
  verifie(`${nom} : les ${blocs.length} paragraphes sont là`, absents.length === 0,
    absents.map((a) => a.texte.slice(0, 40)).join(" / "));
}
verifie("La citation du statut garde ses guillemets d'origine",
  p.texte.includes("<< Pour le personnel formateur") && p.texte.includes(">>"));

// Le modèle de fiche préparation : le bloc d'identité, puis les trois temps.
for (const champ of [
  "Durée de la séance :",
  "Date de la séance :",
  "Groupe :",
  "1ère année",
  "2ème année",
  "Filière :",
  "Module :",
  "Objectifs de la séance :",
]) {
  verifie(`Modèle de fiche : « ${champ} »`, p.texte.includes(champ));
}
for (const rubrique of [
  "Rappel",
  "Eléments de motivation",
  "Plan de la Séance",
  "Stratégies pédagogiques",
  "Synthèse",
  "Evaluation",
  "Prochaine séance",
]) {
  verifie(`Modèle de fiche : rubrique « ${rubrique} »`, p.texte.includes(rubrique));
}

const intro =
  tableaux.map(grille).find((g) => g[0]?.includes("Introduction")) ?? [];
verifie("L'introduction a trois colonnes : durée, zone d'écriture, rubrique",
  intro[1]?.length === 3 && intro[1]?.[0] === "" && intro[1]?.[2] === "Rappel",
  (intro[1] ?? []).join("|"));

// Le modèle de logigramme : seize modules, et des lignes à numéroter.
const modele =
  tableaux
    .map(grille)
    .find((g) => g[0]?.[0] === "N° Modules" && g[0]?.length === 18) ?? [];
verifie("Le modèle de logigramme porte seize colonnes de module",
  (modele[0] ?? []).join("|") ===
    "N° Modules|1|2|3|4|5|6|7|8|9|10|11|12|13|14|15|16|Total",
  (modele[0] ?? []).join("|"));
verifie("Ses deux premières lignes sont la masse horaire et les semaines",
  modele[1]?.[0] === "Masse horaire" && modele[2]?.[0] === "Semaines",
  `${modele[1]?.[0]} / ${modele[2]?.[0]}`);
verifie("Il laisse vingt-quatre semaines à numéroter",
  modele.length === 3 + 24, `${modele.length} lignes`);
verifie("Et ses cases sont vides",
  (modele[5] ?? []).every((c) => c === ""), (modele[5] ?? []).join("|"));

// Six sections : chaque page de titre debout, chaque série de tableaux couchée.
verifie("Six sections", (p.xml.match(/<w:sectPr/g) ?? []).length === 6,
  `${(p.xml.match(/<w:sectPr/g) ?? []).length} sections`);
verifie("Trois sections couchées",
  (p.xml.match(/w:orient="landscape"/g) ?? []).length === 3,
  `${(p.xml.match(/w:orient="landscape"/g) ?? []).length} couchées`);

// Le compte vide : le cahier sort, et ses cases portent un tiret.
const q = await ouvrir(vide, neuf);
verifie("Un compte vide produit tout de même un cahier", q.xml.length > 2000);
verifie("Une ligne non renseignée porte un tiret", q.texte.includes("-"));
verifie("Un compte vide n'écrit pas « null »", !q.texte.includes("null"));
const lignesVide = ((/<w:tbl>[\s\S]*?<\/w:tbl>/.exec(q.xml)?.[0] ?? "").match(/<w:tr[\s>]/g) ?? []).length;

verifie("Fiche d'identité : dix lignes même à vide", lignesVide === 10, `${lignesVide} lignes`);
/*
  Le modèle de logigramme en annexe porte aussi « N° Modules » : on vérifie donc
  que celui de la section C n'est pas là, et non l'absence du mot.
*/
verifie("Sans groupe, la section C ne laisse pas de logigramme",
  !q.texte.includes("Logigramme — "));
verifie("Les annexes paraissent même sur un compte neuf",
  q.texte.includes("Missions du formateur") &&
    q.texte.includes("Modèle de logigramme de la filière"));
verifie("Sans contrôle, la planification le dit",
  q.texte.includes("Aucun contrôle continu enregistré") &&
    q.texte.includes("Aucun examen de fin de module enregistré"));
verifie("Sans évaluation, les tableaux de notes ne paraissent pas",
  q.texte.includes("Aucune évaluation enregistrée") && !q.texte.includes("Moy CC"));
verifie("Sans séance, le suivi le dit au lieu de laisser un vide",
  q.texte.includes("Aucune séance datée sur cette année de formation"));

// Le nom du fichier : classable, sans accent ni espace.
const nom = nomFichierCahier(complet);
verifie("Nom de fichier lisible", nom === "Cahier-du-formateur-EL-KADDOURI-Rachid-2025-2026.docx", nom);
verifie("Nom de fichier d'un compte vide", nomFichierCahier(vide) === "Cahier-du-formateur.docx",
  nomFichierCahier(vide));

console.log(
  fautes === 0
    ? "\n✓ Cahier du formateur : liminaires, parties I et II, annexes conformes au document officiel."
    : `\n✗ ${fautes} contrôle(s) en échec.`,
);
if (fautes) process.exit(1);
