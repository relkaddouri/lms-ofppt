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
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)",
  ],
};
