/**
 * Imprime une partie de la page dans un format de page donné.
 *
 * `@page` est unique par impression et ne se conditionne pas par un sélecteur :
 * on ne peut pas écrire « A4 si telle classe, 16:9 sinon » en CSS. La règle est
 * donc injectée au moment du clic, avec la classe qui dit à `globals.css` quoi
 * rendre visible, et les deux sont retirées ensuite — sinon la deuxième
 * impression hériterait du format de la première.
 */

export type FormatImpression = "diapo" | "document";

const REGLES: Record<FormatImpression, string> = {
  // 13,333 × 7,5 pouces : le 16:9 de PowerPoint, celui du deck de référence.
  // Sans marge, une diapositive va bord à bord.
  diapo: "@page { size: 338.7mm 190.5mm; margin: 0; }",
  // Un document se relie et s'annote : il garde ses marges.
  document: "@page { size: A4 portrait; margin: 18mm 16mm; }",
};

export function imprimer(format: FormatImpression): void {
  const style = document.createElement("style");
  style.setAttribute("data-impression", format);
  style.textContent = REGLES[format];
  document.head.appendChild(style);

  const classe = `impression-${format}`;
  document.documentElement.classList.add(classe);

  const nettoyer = () => {
    document.documentElement.classList.remove(classe);
    style.remove();
    window.removeEventListener("afterprint", nettoyer);
  };
  window.addEventListener("afterprint", nettoyer);

  try {
    window.print();
  } finally {
    // `afterprint` ne se déclenche pas partout — Safari notamment. Le filet
    // évite qu'une page reste bloquée en mode impression.
    setTimeout(nettoyer, 1000);
  }
}
