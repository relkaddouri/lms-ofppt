import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase à privilèges élevés, réservé aux routes serveur.
 * Ne jamais l'importer depuis un composant client : il contourne la RLS.
 * Seule voie d'accès à `get_questions_with_corrige_for_scoring` et `submit_passation`.
 *
 * Accepte les deux nommages Supabase : `SUPABASE_SECRET_KEY` (clés nouvelle
 * génération `sb_secret_…`) ou `SUPABASE_SERVICE_ROLE_KEY` (ancien JWT).
 * Les deux correspondent au rôle Postgres `service_role`.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const secretKey =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !secretKey) {
    throw new Error(
      "Clé serveur Supabase absente (SUPABASE_SECRET_KEY ou SUPABASE_SERVICE_ROLE_KEY)",
    );
  }

  return createSupabaseClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
