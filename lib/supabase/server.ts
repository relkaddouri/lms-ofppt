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

/**
 * Le rôle de l'utilisateur courant.
 *
 * Depuis la migration 075, le jeton porte lui-même la revendication
 * `role_pedago` : la lire évite un aller-retour PostgREST sur chaque rendu du
 * layout protégé — c'est-à-dire sur chaque page de l'espace formateur — pour
 * une valeur qui ne change jamais. Et sans lecture, plus de lecture à
 * refuser : c'est ce qui éteignait l'espace entier quand les horloges de
 * Supabase divergeaient d'une seconde (commit 47b3df9).
 *
 * `getClaims()` plutôt que `getUser()` ici : le projet signe en ES256, donc
 * la vérification se fait localement contre le JWKS, que `auth-js` garde dans
 * un cache global au processus — une seule récupération par démarrage à
 * froid. `getUser()` interrogeait le service d'authentification à chaque
 * appel, et le layout le fait déjà de son côté pour établir l'identité.
 *
 * `getSession()` ne conviendrait pas : elle lit le cookie sans vérifier la
 * signature, ce qui ne suffit pas pour une valeur dont dépend une
 * redirection.
 */
export async function getCurrentUserRole() {
  const supabase = await createClient();

  // Une vérification qui échoue n'a pas à coûter la page : le repli PostgREST
  // reste là pour trancher.
  const revendications = await supabase.auth
    .getClaims()
    .then((r) => r.data?.claims ?? null)
    .catch(() => null);

  if (!revendications || typeof revendications.sub !== "string") return null;
  const identifiant = revendications.sub;

  // `role_pedago` et non `role` : cette dernière est le rôle Postgres du
  // jeton Supabase, celui sur lequel PostgREST fait son `set role`. La
  // migration 075 explique pourquoi les confondre casserait tout.
  //
  // Absente tant que le crochet n'est pas activé côté Supabase, et pour une
  // session ouverte avant son activation : la revendication n'entre dans le
  // jeton qu'au renouvellement suivant.
  const duJeton = revendications.role_pedago;
  if (typeof duJeton === "string" && duJeton.length > 0) return duJeton;

  const lire = () =>
    supabase.from("profils").select("role").eq("id", identifiant).maybeSingle();

  let { data, error } = await lire();

  // Repli, emprunté tant que le crochet n'est pas activé ou que la session
  // date d'avant : PostgREST refuse parfois un jeton tout juste renouvelé —
  // `JWT issued at future` — quand son horloge retarde de quelques secondes
  // sur celle du service qui l'a émis. Le cas se résout de lui-même en une
  // seconde. Comme cette fonction n'est appelée que par le layout protégé, y
  // jeter éteint l'espace formateur entier : un tel incident mérite un second
  // essai, pas un écran d'erreur.
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
