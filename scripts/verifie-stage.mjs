#!/usr/bin/env node
/**
 * Garde-fou : ce qui part au commit est bien ce qu'on croit y mettre.
 *
 * Trois incidents, tous causés par un `git add -A` suivi d'un commit sans
 * relecture du diff. Un contrôle par incident, pas de règle générale :
 *
 * 1. `app/actions/seance.ts` — un fichier mort remis dans l'arbre par un
 *    `add -A`, doublon de sept symboles, importé par personne.
 * 2. `docs/design_system.md` — trois sections perdues, le fichier ayant été
 *    remplacé par une copie plus ancienne. Committé sans que la disparition
 *    se voie.
 * 3. Le même fichier, une seconde fois, deux jours plus tard.
 *
 * Aucun de ces trois cas n'était visible dans la liste des fichiers stagés :
 * il fallait lire le diff. C'est ce que fait ce script à la place.
 *
 * Contourner volontairement : `PEDAGO_STAGE_OK=1 git commit …`.
 */

import { execFileSync } from "node:child_process";

const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });

const alertes = [];

/** Fichiers stagés, avec leur statut (A ajouté, M modifié, D supprimé…). */
const stages = git("diff", "--cached", "--name-status")
  .split("\n")
  .filter(Boolean)
  .map((l) => {
    const [statut, ...chemins] = l.split("\t");
    return { statut: statut[0], chemin: chemins[chemins.length - 1] };
  });

if (stages.length === 0) process.exit(0);

// ── 1. Un fichier de code ajouté que personne n'importe ────────────────
//
// Un module neuf sans un seul point d'entrée est soit un oubli de câblage,
// soit un fichier mort ramassé au passage. Les deux méritent un regard.
const CODE = /^(app|lib|components)\/.*\.(ts|tsx)$/;
const POINTS_ENTREE =
  /(^app\/.*\/(page|layout|route|proxy)\.tsx?$)|(^app\/globals\.css$)|\.d\.ts$/;

for (const { statut, chemin } of stages) {
  if (statut !== "A" || !CODE.test(chemin) || POINTS_ENTREE.test(chemin)) continue;

  // Deux écritures mènent au même fichier : l'alias « @/lib/format » et le
  // relatif « ./ModeAnimation » entre voisins d'un même dossier. Ne chercher
  // que la première signalait à tort tout composant importé par le `page.tsx`
  // d'à côté — le garde-fou aurait crié à chaque écran neuf.
  const sansExt = chemin.replace(/\.(ts|tsx)$/, "");
  const base = sansExt.split("/").pop();
  const formes = [`@/${sansExt}`, `/${base}"`, `/${base}'`];

  const cites = new Set();
  for (const forme of formes) {
    try {
      for (const f of git("grep", "-l", "-F", forme, "--", "app", "lib", "components").split("\n")) {
        if (f && f !== chemin) cites.add(f);
      }
    } catch {
      // git grep sort en 1 quand il ne trouve rien : ce n'est pas une erreur.
    }
  }
  if (cites.size === 0) {
    alertes.push(
      `${chemin} est ajouté mais aucun fichier ne l'importe.\n` +
        `    Câblage oublié, ou fichier mort ramassé par un « git add -A » ?`,
    );
  }
}

// ── 2. Un document qui perd des sections ───────────────────────────────
//
// Un titre présent dans la version committée et absent de la version stagée
// est presque toujours un fichier écrasé par une copie plus ancienne, pas une
// suppression voulue — celles-ci se font section par section.
const TITRE = /^#{1,3} .+$/gm;

for (const { statut, chemin } of stages) {
  if (statut !== "M" || !chemin.endsWith(".md")) continue;

  const avant = git("show", `HEAD:${chemin}`).match(TITRE) ?? [];
  const apres = git("show", `:${chemin}`).match(TITRE) ?? [];
  const restants = new Set(apres);
  const perdus = avant.filter((t) => !restants.has(t));

  if (perdus.length > 0) {
    alertes.push(
      `${chemin} perd ${perdus.length} titre${perdus.length > 1 ? "s" : ""} :\n` +
        perdus.map((t) => `      ${t}`).join("\n") +
        `\n    Suppression voulue, ou fichier remplacé par une copie plus ancienne ?`,
    );
  }
}

// ── 3. Un fichier réécrit de bout en bout ──────────────────────────────
//
// Beaucoup de suppressions pour peu d'ajouts : ce n'est plus une
// modification, c'est un remplacement. Il peut être légitime — il ne peut
// pas passer sans qu'on l'ait regardé.
for (const ligne of git("diff", "--cached", "--numstat").split("\n").filter(Boolean)) {
  const [ajouts, retraits, chemin] = ligne.split("\t");
  if (ajouts === "-" || retraits === "-") continue; // binaire
  const a = Number(ajouts);
  const r = Number(retraits);
  if (r >= 40 && r > a * 3) {
    alertes.push(
      `${chemin} perd ${r} lignes pour ${a} ajoutée${a > 1 ? "s" : ""}.\n` +
        `    C'est un remplacement, pas une modification — relisez le diff.`,
    );
  }
}

if (alertes.length === 0) {
  console.log("✓ Contenu stagé : rien d'inattendu.");
  process.exit(0);
}

console.error("\n✗ Le contenu stagé mérite une relecture avant commit :\n");
for (const a of alertes) console.error(`  • ${a}\n`);
console.error("  Relisez :  git diff --staged\n");
console.error(
  "  Si c'est voulu :  PEDAGO_STAGE_OK=1 git commit …\n" +
    "  (et si vous avez utilisé « git add -A », c'est justement le geste que\n" +
    "   conventions.md interdit — stagez les fichiers un par un.)\n",
);
process.exit(1);
