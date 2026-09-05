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

/**
 * Écart, en secondes, entre la date d'émission du jeton et l'heure d'ici.
 *
 * Sert uniquement à qualifier un échec : si ce runtime voit un `iat` déjà
 * passé alors que PostgREST le refuse comme futur, le décalage est entre les
 * services de Supabase et non chez nous — ce qui n'appelle pas la même
 * correction. La lecture n'est pas une vérification : on lit le cookie sans
 * valider la signature, ce qui n'a aucune conséquence puisque rien ici n'en
 * dépend pour autoriser quoi que ce soit.
 */
async function ageDuJeton(): Promise<string> {
  try {
    const cookieStore = await cookies();
    const jeton = cookieStore
      .getAll()
      .filter((c) => /^sb-.*-auth-token(\.\d+)?$/.test(c.name))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => c.value)
      .join("")
      .replace(/^base64-/, "");
    const brut = jeton.startsWith("ey")
      ? jeton
      : Buffer.from(jeton, "base64").toString("utf8");
    const acces = brut.startsWith("ey")
      ? brut
      : (JSON.parse(brut).access_token as string);
    const charge = JSON.parse(
      Buffer.from(acces.split(".")[1]!, "base64url").toString("utf8"),
    ) as { iat?: number };
    if (!charge.iat) return "iat absent";
    return `iat émis il y a ${Math.round(Date.now() / 1000 - charge.iat)}s selon cette machine`;
  } catch {
    return "iat illisible";
  }
}

/** Le temps qu'une horloge en retard a pour rattraper l'émission du jeton. */
const DELAI_SECONDE_LECTURE = 1000;

export async function getCurrentUserRole() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const lire = () =>
    supabase.from("profils").select("role").eq("id", user.id).maybeSingle();

  let { data, error } = await lire();

  // PostgREST refuse parfois un jeton tout juste renouvelé — `JWT issued at
  // future` — quand son horloge retarde de quelques secondes sur celle du
  // service qui l'a émis. Le cas se résout de lui-même en une seconde. Comme
  // cette fonction n'est appelée que par le layout protégé, y jeter éteint
  // l'espace formateur entier : un tel incident mérite un second essai, pas
  // un écran d'erreur.
  if (error) {
    console.error(
      "[auth] lecture du rôle, premier échec",
      error.code,
      error.message,
      await ageDuJeton(),
    );
    await new Promise((r) => setTimeout(r, DELAI_SECONDE_LECTURE));
    ({ data, error } = await lire());
  }

  // Une panne de lecture donnait un rôle nul, donc une redirection vers la
  // connexion : l'utilisateur se croyait déconnecté. On distingue les deux.
  if (error) {
    console.error("[auth] lecture du rôle", error.code, error.message);
    throw new Error("Impossible de vérifier vos droits. Réessayez.");
  }

  return data?.role ?? null;
}
