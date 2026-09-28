import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Rafraîchissement de la session Supabase à chaque requête.
 *
 * Sans ce fichier, le jeton d'accès n'est jamais renouvelé : un composant
 * serveur ne peut pas poser de cookie pendant son rendu, et c'est bien pour
 * cette raison que `lib/supabase/server.ts` avale silencieusement l'échec
 * d'écriture. Le formateur se retrouvait déconnecté à l'expiration du jeton,
 * sans rien qui explique pourquoi.
 *
 * Next 16 a renommé `middleware` en `proxy` (le fichier `middleware.ts` reste
 * accepté mais est déprécié) : voir la référence `proxy.js` livrée dans
 * `node_modules/next/dist/docs`.
 *
 * Ce fichier ne décide d'aucune autorisation. Les redirections restent dans
 * les layouts, qui seuls connaissent le rôle : le proxy tourne en amont du
 * rendu et n'a pas à dupliquer cette règle.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Les cookies rafraîchis doivent partir dans les deux sens : vers la
          // suite du traitement de cette requête, et vers le navigateur.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // C'est cet appel qui renouvelle le jeton quand il approche de l'expiration.
  // Ne rien en faire est volontaire : on ne veut que l'effet de bord.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  /**
   * Sans matcher, le proxy tournerait aussi sur les fichiers statiques et les
   * polices — un aller-retour Supabase par image chargée.
   *
   * Deux exclusions ajoutées après l'audit du 26/09/2026, et une troisième
   * — les préchargements — après celui du 28/09/2026 :
   *
   * - `api/` : les onze routes vérifient elles-mêmes l'utilisateur et
   *   répondent 401 s'il manque. Les faire précéder du proxy revenait à
   *   demander deux fois au serveur d'authentification Supabase si la
   *   personne existe, pour une seule requête. Le jeton continue d'être
   *   rafraîchi à chaque navigation, ce qui suffit.
   * - `ttf` : les quatre polices du projet sont en `.ttf`, extension absente
   *   de la liste — chaque première visite déclenchait donc quatre
   *   exécutions du proxy pour charger des caractères.
   */
  matcher: [
    {
      source:
        "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf)$).*)",
      /**
       * Les préchargements ne réveillent plus le proxy (audit du 28/09/2026,
       * correction 1).
       *
       * Next va chercher à l'avance chaque lien qui apparaît à l'écran, sans
       * qu'on ait cliqué, et seulement en production — d'où l'invisibilité
       * totale du phénomène en développement. Mesuré sur l'application :
       * quarante liens distincts sur la progression d'un groupe, trente sur
       * la fiche d'un groupe. Ouvrir un de ces écrans déclenchait donc
       * jusqu'à quarante et une exécutions du proxy, chacune demandant à
       * Supabase qui est là. C'est ce qui tenait la part « middleware » à
       * 35 % de la facture, que rien du premier audit n'avait touchée.
       *
       * Sans risque pour la session : un préchargement n'est pas une visite,
       * personne ne regarde l'écran à ce moment-là, et la vraie navigation
       * qui suit rafraîchit le jeton comme avant. Sans risque pour l'accès
       * non plus : ce fichier ne décide d'aucune autorisation — ce sont les
       * policies RLS et les redirections des layouts qui gardent la porte, et
       * elles s'appliquent au préchargement comme au reste.
       *
       * L'en-tête de préchargement, et lui seul : `_rsc` accompagne aussi les
       * vraies navigations entre pages, et l'exclure aurait cessé de
       * rafraîchir la session dès qu'on ne recharge plus la page entière.
       */
      missing: [{ type: "header", key: "next-router-prefetch" }],
    },
  ],
};
