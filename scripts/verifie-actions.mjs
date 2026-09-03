#!/usr/bin/env node
/**
 * Garde-fou : un module « use server » n'exporte que des fonctions async.
 *
 * Next refuse tout autre export — une constante, une fonction synchrone — et
 * la sanction tombe à l'exécution, pas à la compilation : `tsc` reste vert et
 * l'application entière renvoie 500, `/login` compris, ce qui envoie chercher
 * la panne au mauvais endroit. C'est arrivé quatre fois sur ce projet
 * (`JOURS`, `LOGO_TAILLE_MAX`, `heuresPortees`), d'où cette vérification
 * plutôt qu'une règle qu'on se rappelle.
 *
 * Les types sont effacés à la compilation : `export type` et
 * `export interface` restent autorisés.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RACINE = process.cwd();
const IGNORE = new Set(["node_modules", ".next", ".git", "supabase"]);

/** Tous les fichiers TypeScript du projet, sans les dossiers générés. */
function fichiers(dossier) {
  const trouves = [];
  for (const entree of readdirSync(dossier)) {
    if (IGNORE.has(entree)) continue;
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) trouves.push(...fichiers(chemin));
    else if (/\.tsx?$/.test(entree)) trouves.push(chemin);
  }
  return trouves;
}

/**
 * Vrai si la directive est en tête du module.
 *
 * Une action « inline » écrite dans le corps d'une fonction porte la même
 * directive sans faire du fichier un module serveur : seule celle qui précède
 * le premier import compte.
 */
function estModuleServeur(source) {
  for (const ligne of source.split("\n")) {
    const l = ligne.trim();
    if (!l || l.startsWith("//") || l.startsWith("/*") || l.startsWith("*")) continue;
    return /^["']use server["'];?$/.test(l);
  }
  return false;
}

const INTERDIT =
  /^export\s+(?!async\s+function\b)(?!type\b)(?!interface\b)(const|let|var|function|class|default|\{)/;

const fautes = [];

for (const chemin of fichiers(RACINE)) {
  const source = readFileSync(chemin, "utf8");
  if (!estModuleServeur(source)) continue;

  source.split("\n").forEach((ligne, i) => {
    if (INTERDIT.test(ligne.trim())) {
      fautes.push({ chemin: relative(RACINE, chemin), ligne: i + 1, texte: ligne.trim() });
    }
  });
}

if (fautes.length === 0) {
  console.log("✓ Modules « use server » : aucun export non-async.");
  process.exit(0);
}

console.error(
  `\n✗ ${fautes.length} export interdit${fautes.length > 1 ? "s" : ""} dans un module « use server ».\n`,
);
for (const f of fautes) {
  console.error(`  ${f.chemin}:${f.ligne}`);
  console.error(`    ${f.texte}\n`);
}
console.error(
  "Un fichier « use server » n'exporte que des fonctions async (les types sont\n" +
    "autorisés). Déplacez la valeur ou la fonction synchrone dans lib/<sujet>.ts.\n" +
    "Sans cela l'application entière renvoie 500 à l'exécution, avec un tsc vert.\n",
);
process.exit(1);
