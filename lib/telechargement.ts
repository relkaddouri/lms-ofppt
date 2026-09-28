/**
 * Déclencher le téléchargement d'un fichier signé (signalé le 28/09/2026).
 *
 * `window.open` ne marche pas ici : le navigateur n'autorise l'ouverture
 * d'une fenêtre que dans la foulée immédiate du clic. Or le lien est signé
 * par le serveur, donc obtenu après une attente — au retour, le geste de
 * l'utilisateur est « périmé » et la fenêtre est bloquée **sans rien dire**.
 * Le formateur cliquait sur « Télécharger » et il ne se passait rien.
 *
 * Un lien créé puis cliqué n'est jamais bloqué. Encore faut-il que le serveur
 * renvoie le fichier en pièce jointe (`download` à la signature) : sans cela
 * le navigateur quitterait l'application pour afficher le document.
 */
export function telechargerFichier(url: string, nom?: string) {
  const lien = document.createElement("a");
  lien.href = url;
  // Sans effet sur un domaine tiers — c'est l'en-tête du fichier signé qui
  // décide —, mais il donne le bon nom quand l'origine est la même.
  if (nom) lien.download = nom;
  lien.rel = "noopener";
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
}
