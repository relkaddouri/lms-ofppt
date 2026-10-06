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
import type { CahierPartieI } from "@/app/actions/cahier";
import {
  logigrammes,
  semaineIso,
  type LigneAffectation,
  type LigneGroupe,
  type LigneSeance,
} from "@/lib/logigramme";
import { PROCEDURES } from "@/lib/docx-cahier-textes";

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

// ── Outils de lecture du paquet ───────────────────────────────────────────

type Paquet = { zip: JSZip; xml: string; texte: string };

async function ouvrir(
  e: Etablissement,
  data: CahierPartieI = partie1,
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

verifie("Deux sections : textes debout, tableaux couchés",
  (p.xml.match(/<w:sectPr/g) ?? []).length === 2,
  `${(p.xml.match(/<w:sectPr/g) ?? []).length} sections`);
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

// Le compte vide : le cahier sort, et ses cases portent un tiret.
const q = await ouvrir(vide, partie1Vide);
verifie("Un compte vide produit tout de même un cahier", q.xml.length > 2000);
verifie("Une ligne non renseignée porte un tiret", q.texte.includes("-"));
verifie("Un compte vide n'écrit pas « null »", !q.texte.includes("null"));
const lignesVide = ((/<w:tbl>[\s\S]*?<\/w:tbl>/.exec(q.xml)?.[0] ?? "").match(/<w:tr[\s>]/g) ?? []).length;

verifie("Fiche d'identité : dix lignes même à vide", lignesVide === 10, `${lignesVide} lignes`);
verifie("Sans groupe, le logigramme ne laisse pas de tableau vide",
  !q.texte.includes("N° Modules"));
verifie("Sans séance, le suivi le dit au lieu de laisser un vide",
  q.texte.includes("Aucune séance datée sur cette année de formation"));

// Le nom du fichier : classable, sans accent ni espace.
const nom = nomFichierCahier(complet);
verifie("Nom de fichier lisible", nom === "Cahier-du-formateur-EL-KADDOURI-Rachid-2025-2026.docx", nom);
verifie("Nom de fichier d'un compte vide", nomFichierCahier(vide) === "Cahier-du-formateur.docx",
  nomFichierCahier(vide));

console.log(
  fautes === 0
    ? "\n✓ Cahier du formateur : liminaires et partie I conformes au document officiel."
    : `\n✗ ${fautes} contrôle(s) en échec.`,
);
if (fautes) process.exit(1);
