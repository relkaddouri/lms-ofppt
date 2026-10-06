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

// ── Outils de lecture du paquet ───────────────────────────────────────────

type Paquet = { zip: JSZip; xml: string; texte: string };

async function ouvrir(e: Etablissement): Promise<Paquet> {
  const blob = await cahierDuFormateur(e);
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

// La fiche d'identité : dix lignes, deux colonnes, pas une de moins.
const tableaux = [...p.xml.matchAll(/<w:tbl>[\s\S]*?<\/w:tbl>/g)].map((m) => m[0]);
verifie("Un seul tableau à ce stade : la fiche d'identité", tableaux.length === 1,
  `${tableaux.length} trouvés`);
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

// Le compte vide : le cahier sort, et ses cases portent un tiret.
const q = await ouvrir(vide);
verifie("Un compte vide produit tout de même un cahier", q.xml.length > 2000);
verifie("Une ligne non renseignée porte un tiret", q.texte.includes("-"));
verifie("Un compte vide n'écrit pas « null »", !q.texte.includes("null"));
const lignesVide = ((/<w:tbl>[\s\S]*?<\/w:tbl>/.exec(q.xml)?.[0] ?? "").match(/<w:tr[\s>]/g) ?? []).length;
verifie("Fiche d'identité : dix lignes même à vide", lignesVide === 10, `${lignesVide} lignes`);

// Le nom du fichier : classable, sans accent ni espace.
const nom = nomFichierCahier(complet);
verifie("Nom de fichier lisible", nom === "Cahier-du-formateur-EL-KADDOURI-Rachid-2025-2026.docx", nom);
verifie("Nom de fichier d'un compte vide", nomFichierCahier(vide) === "Cahier-du-formateur.docx",
  nomFichierCahier(vide));

console.log(
  fautes === 0
    ? "\n✓ Cahier du formateur : couverture, fiche d'identité et procédures conformes."
    : `\n✗ ${fautes} contrôle(s) en échec.`,
);
if (fautes) process.exit(1);
