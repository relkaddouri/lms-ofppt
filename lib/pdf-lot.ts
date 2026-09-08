import { jsPDF } from "jspdf";
import type { Marque } from "@/lib/pdf-marque";
import { installerPolices } from "@/lib/pdf-theme";
import { dessinerResultat } from "@/lib/pdf-resultat";
import { dessinerEmargement, type FeuilleEmargement } from "@/lib/pdf-emargement";
import { dessinerPageDeGarde, type PageDeGarde } from "@/lib/pdf-garde";
import type { ResultatControle } from "@/lib/resultat";

/**
 * Toutes les copies d'un contrôle dans un seul fichier (PRD §4.7).
 *
 * Le formateur qui publie une classe entière imprimait vingt-cinq documents
 * l'un après l'autre. Un seul fichier, une seule impression.
 *
 * L'ordre est celui de la chemise cartonnée : la page de garde, qui se
 * détache pour être collée dessus ; la feuille d'émargement quand elle est
 * jointe, parce que l'administration demande d'abord qui était là ; puis les
 * résultats, chacun sur ses propres pages.
 *
 * Chaque résultat garde sa numérotation interne — « page 2 / 2 » et non
 * « page 14 / 31 » : le stagiaire reçoit ses feuilles détachées du reste, et
 * doit pouvoir vérifier qu'il les a toutes.
 */
export async function telechargerLotPdf(
  resultats: ResultatControle[],
  nomFichier: string,
  options: {
    garde?: PageDeGarde | null;
    emargement?: FeuilleEmargement | null;
    marque?: Marque;
  } = {},
): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  await installerPolices(doc);

  let premiere = true;
  const page = () => {
    if (!premiere) doc.addPage();
    premiere = false;
  };

  if (options.garde) {
    page();
    dessinerPageDeGarde(doc, options.garde, options.marque);
  }

  if (options.emargement) {
    page();
    dessinerEmargement(doc, options.emargement, options.marque);
  }

  for (const resultat of resultats) {
    page();
    dessinerResultat(doc, resultat, options.marque);
  }

  doc.save(nomFichier);
}
