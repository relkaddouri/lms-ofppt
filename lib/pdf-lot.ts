import { jsPDF } from "jspdf";
import type { Marque } from "@/lib/pdf-marque";
import { COULEURS, installerPolices, police } from "@/lib/pdf-theme";
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
 *
 * Et chaque pièce commence au recto, parce que le dossier s'imprime en
 * recto-verso. Une copie de trois pages laisserait sinon la suivante démarrer
 * au dos de sa dernière feuille : deux stagiaires sur la même feuille, qu'on
 * ne peut plus détacher l'un de l'autre.
 *
 * Le remède n'est ni une ni deux pages blanches entre les copies — avec un
 * nombre fixe, le décalage revient dès que la copie précédente change de
 * longueur. C'est le nombre de pages de chaque pièce qu'on complète à un
 * nombre pair.
 *
 * Et cela ne coûte aucune feuille : une copie de trois pages en occupe déjà
 * deux en recto-verso, dont un verso resté blanc. On ne fait que le nommer.
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

  /**
   * La page blanche de complément, nommée.
   *
   * Une page vide dans un dossier relié passe pour une erreur d'impression ou
   * pour une feuille perdue. La mention lève le doute de celui qui relit avant
   * de signer — c'est l'usage des pièces administratives.
   */
  const pageDeComplement = () => {
    doc.addPage();
    police(doc, "corps", 8.5);
    doc.setTextColor(...COULEURS.muet);
    doc.text("Page laissée intentionnellement blanche", 105, 148, {
      align: "center",
    });
  };

  const pieces: (() => void)[] = [];
  if (options.garde) {
    pieces.push(() => dessinerPageDeGarde(doc, options.garde!, options.marque));
  }
  if (options.emargement) {
    pieces.push(() =>
      dessinerEmargement(doc, options.emargement!, options.marque),
    );
  }
  for (const resultat of resultats) {
    pieces.push(() => dessinerResultat(doc, resultat, options.marque));
  }

  pieces.forEach((dessiner, i) => {
    page();
    dessiner();
    // Une pièce commence au recto lorsque son numéro de page est impair. Si le
    // compte est impair une fois la pièce finie, la suivante tomberait au
    // verso : on complète.
    //
    // Rien après la dernière : une page blanche en fin de dossier ne sert
    // personne, et se remarque.
    if (i < pieces.length - 1 && doc.getNumberOfPages() % 2 === 1) {
      pageDeComplement();
    }
  });

  doc.save(nomFichier);
}
