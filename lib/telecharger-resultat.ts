import {
  getDossierControle,
  getResultatASigner,
  getSujetControle,
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

/**
 * Le nom d'un fichier, selon la convention arrêtée par le porteur de projet.
 *
 * `Dossier_CC1_DDOUX201_M104_2026-09-07` : la pièce, l'épreuve, le groupe, le
 * module, la date. Un segment sans valeur disparaît plutôt que de laisser un
 * trou entre deux tirets bas, et la date reste en ISO pour que les fichiers se
 * trient d'eux-mêmes.
 *
 * La durée du contrôle n'y figure pas, bien qu'elle ait été proposée. Elle
 * n'identifie rien — deux contrôles ne peuvent pas partager le même code
 * d'épreuve sur le même groupe, le même module et le même jour — et elle se
 * modifie : la changer après coup donnerait un second fichier pour le même
 * dossier, à côté de celui déjà classé. Un nom de fichier porte des
 * identifiants, pas des attributs ; la durée vit sur la page de garde et dans
 * le cartouche, où elle reste juste.
 */
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
      "Dossier",
      dossier.codeEpreuve,
      dossier.identification.groupe
        ? slugify(dossier.identification.groupe)
        : null,
      dossier.codeModule ? slugify(dossier.codeModule) : null,
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
      "Emargement",
      dossier.codeEpreuve,
      dossier.identification.groupe
        ? slugify(dossier.identification.groupe)
        : null,
      dossier.codeModule ? slugify(dossier.codeModule) : null,
      dossier.dateFichier ?? maintenant(),
    ])}.pdf`,
    marqueDe(etablissement),
  );
  return true;
}

/**
 * Le sujet vierge, à faire viser par le chef de pôle.
 *
 * Il ne dépend d'aucune copie : il s'édite avant l'épreuve, quand rien n'a
 * encore été composé. C'est aussi pourquoi il n'exige pas de résultat publié,
 * contrairement au dossier.
 */
export async function telechargerSujet(controleId: string): Promise<boolean> {
  const [sujet, etablissement] = await Promise.all([
    getSujetControle(controleId),
    getEtablissement(),
  ]);
  if (!sujet || sujet.questions.length === 0) return false;

  const { telechargerSujetPdf } = await import("@/lib/pdf-sujet");

  await telechargerSujetPdf(
    sujet,
    `${nommer([
      "Sujet",
      sujet.codeEpreuve,
      sujet.groupe ? slugify(sujet.groupe) : null,
      sujet.codeModule ? slugify(sujet.codeModule) : null,
      sujet.dateFichier ?? maintenant(),
    ])}.pdf`,
    marqueDe(etablissement),
  );
  return true;
}
