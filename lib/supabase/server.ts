import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

/**
 * Client Supabase typé sur le schéma réel.
 *
 * `database.types.ts` est régénéré depuis la base par
 * `npx supabase gen types typescript --linked`. Sans lui, chaque requête
 * renvoyait `any` : une colonne renommée ou supprimée ne se voyait qu'à
 * l'exécution, et les `as unknown as { … }` du code n'étaient vérifiés par
 * rien.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Un composant serveur ne peut pas poser de cookie pendant son
            // rendu : c'est `proxy.ts` qui rafraîchit la session en amont.
          }
        },
      },
    },
  );
}

export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentUserRole() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("profils")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  // Une panne de lecture donnait un rôle nul, donc une redirection vers la
  // connexion : l'utilisateur se croyait déconnecté. On distingue les deux.
  if (error) {
    console.error("[auth] lecture du rôle", error.message);
    throw new Error("Impossible de vérifier vos droits. Réessayez.");
  }

  return data?.role ?? null;
}
