import { getResultatASigner } from "@/app/actions/controles";
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
