/**
 * Règles typographiques françaises pour les documents produits.
 *
 * En français, le point d'interrogation, le point d'exclamation, les
 * deux-points, le point-virgule et le guillemet fermant se posent après une
 * espace — mais cette espace ne se coupe pas. Le guillemet ouvrant obéit à la
 * règle symétrique : il ne finit pas une ligne.
 *
 * `splitTextToSize` de jsPDF ne connaît que l'espace ordinaire : il coupait
 * donc « … abandonnent-ils leur panier ? » en laissant « ? » seul en tête de
 * la ligne suivante, ce qui se voit tout de suite sur un document imprimé.
 * Remplacer l'espace par une espace insécable suffit à l'en empêcher, sans
 * changer ce qui est lu.
 */
export function insecable(texte: string): string {
  return texte
    .replace(/ +([?!:;»%])/g, " $1")
    .replace(/« +/g, "« ");
}
