import type { MetadataRoute } from "next";

/**
 * Ce que les robots d'indexation ont le droit de visiter (audit CPU du
 * 26/09/2026, correction 9).
 *
 * Rien, sauf la page de connexion. Tout le reste est derrière
 * l'authentification : un robot n'y trouverait qu'une redirection, mais
 * chaque tentative fait tourner le proxy, donc une fonction facturée.
 *
 * Ce fichier ne protège rien — les politiques de la base le font. Il évite
 * seulement un travail inutile, et empêche que l'espace d'un établissement
 * apparaisse dans un moteur de recherche.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/login",
        disallow: "/",
      },
    ],
  };
}
