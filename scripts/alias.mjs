/**
 * Apprend à Node l'alias « @/ » du projet, et l'extension qui va avec.
 *
 * Les scripts de vérification tournent sous Node, qui ne lit ni tsconfig ni
 * la configuration de Next : un import « @/lib/… » y échoue, et un import
 * sans extension aussi. Le dépôt emploie cet alias partout, et ce n'est pas
 * au code de l'application de plier pour ses contrôles — c'est au lanceur de
 * savoir le résoudre.
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

const racine = pathToFileURL(`${process.cwd()}/`).href;

register(
  `data:text/javascript,
   import { existsSync } from "node:fs";
   import { fileURLToPath } from "node:url";
   export async function resolve(specifier, context, suivant) {
     if (!specifier.startsWith("@/")) return suivant(specifier, context);
     const base = new URL(specifier.slice(2), ${JSON.stringify(racine)}).href;
     for (const suffixe of ["", ".ts", ".tsx", "/index.ts"]) {
       const essai = base + suffixe;
       if (existsSync(fileURLToPath(essai))) return suivant(essai, context);
     }
     return suivant(base, context);
   }`,
  import.meta.url,
);
