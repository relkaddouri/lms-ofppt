import {
  getDossierControle,
  getResultatASigner,
} from "@/app/actions/controles";
import { getEtablissement } from "@/app/actions/etablissement";
import { marqueDe } from "@/lib/pdf-marque";
import { maintenant, slugify } from "@/lib/format";

/**
 * Télécharge le résultat à signer d'une copie (PRD §4.7).
 *
 * Deux écrans le proposent — la liste des copies et l'écran de correction — et
 * ils n'ont pas les mêmes données sous la main. Le geste vit donc ici : ils
 * passent un identifiant, le serveur assemble le document, et le moteur PDF
 * n'est chargé qu'au moment du clic.
 *
 * Rend `false` quand le résultat n'est pas publié. Le document porte la
 * mention « publié le » : le produire avant que le stagiaire n'ait rien reçu
 * ferait signer une pièce qui n'existe pas encore.
 */
export async function telechargerResultatSigne(
  passationId: string,
): Promise<boolean> {
  const [resultat, etablissement] = await Promise.all([
    getResultatASigner(passationId),
    getEtablissement(),
  ]);
  if (!resultat) return false;

  const { telechargerResultatPdf } = await import("@/lib/pdf-resultat");

  // NOM_MODULE_CEF_ÉPREUVE_DATE, la convention arrêtée par le porteur de
  // projet. La date est en ISO pour que les fichiers se trient ; un segment
  // sans valeur disparaît plutôt que de laisser un trou entre deux tirets bas.
  const nomFichier = [
    slugify(resultat.stagiaire, "stagiaire"),
    resultat.codeModule ? slugify(resultat.codeModule) : null,
    resultat.cef ? slugify(resultat.cef) : null,
    resultat.codeEpreuve,
    resultat.dateFichier ?? maintenant(),
  ]
    .filter(Boolean)
    .join("_");

  await telechargerResultatPdf(
    resultat,
    `${nomFichier}.pdf`,
    marqueDe(etablissement),
  );
  return true;
}

/** Le nom d'un fichier de résultat, selon la convention arrêtée. */
function nommer(parties: (string | null | undefined)[]): string {
  return parties.filter(Boolean).join("_");
}

/**
 * Toutes les copies publiées d'un contrôle, dans un seul fichier (PRD §4.7).
 *
 * `avecEmargement` place la feuille de présence en tête : c'est l'ordre dans
 * lequel l'administration reçoit le dossier — qui était là, puis ce que
 * chacun a obtenu. Le formateur qui n'imprime que pour rendre les copies s'en
 * passe, d'où la case à cocher plutôt qu'un choix figé.
 *
 * Rend le nombre de copies éditées, `0` quand aucune n'est publiée.
 */
export async function telechargerLotResultats(
  controleId: string,
  avecEmargement: boolean,
): Promise<number> {
  const [dossier, etablissement] = await Promise.all([
    getDossierControle(controleId),
    getEtablissement(),
  ]);
  if (!dossier || dossier.resultats.length === 0) return 0;

  const { telechargerLotPdf } = await import("@/lib/pdf-lot");

  await telechargerLotPdf(
    dossier.resultats,
    `${nommer([
      "RESULTATS",
      dossier.identification.groupe
        ? slugify(dossier.identification.groupe)
        : null,
      dossier.codeModule ? slugify(dossier.codeModule) : null,
      dossier.codeEpreuve,
      dossier.dateFichier ?? maintenant(),
    ])}.pdf`,
    {
      marque: marqueDe(etablissement),
      // La page de garde ouvre toujours le dossier : elle se détache pour être
      // collée sur la chemise, et un dossier sans elle n'est identifiable
      // qu'en l'ouvrant.
      garde: {
        titre: dossier.titre,
        nature: dossier.nature,
        identification: dossier.identification,
        effectif: dossier.stagiaires.length,
        copies: dossier.resultats.length,
        moyenne: dossier.moyenne,
        total: dossier.total,
        avecEmargement,
        dateEdition: new Date().toLocaleDateString("fr-FR"),
      },
      emargement: avecEmargement
        ? {
            titre: dossier.titre,
            nature: dossier.nature,
            identification: dossier.identification,
            stagiaires: dossier.stagiaires,
          }
        : null,
    },
  );
  return dossier.resultats.length;
}

/**
 * La feuille d'émargement seule.
 *
 * Elle ne dépend d'aucune copie : elle liste le groupe, pas ceux qui ont
 * rendu. Le formateur l'imprime donc avant l'épreuve, pour la faire signer
 * pendant, alors qu'aucun résultat n'existe encore.
 */
export async function telechargerEmargement(
  controleId: string,
): Promise<boolean> {
  const [dossier, etablissement] = await Promise.all([
    getDossierControle(controleId),
    getEtablissement(),
  ]);
  if (!dossier) return false;

  const { telechargerEmargementPdf } = await import("@/lib/pdf-emargement");

  await telechargerEmargementPdf(
    {
      titre: dossier.titre,
      nature: dossier.nature,
      identification: dossier.identification,
      stagiaires: dossier.stagiaires,
    },
    `${nommer([
      "EMARGEMENT",
      dossier.identification.groupe
        ? slugify(dossier.identification.groupe)
        : null,
      dossier.codeModule ? slugify(dossier.codeModule) : null,
      dossier.codeEpreuve,
      dossier.dateFichier ?? maintenant(),
    ])}.pdf`,
    marqueDe(etablissement),
  );
  return true;
}
