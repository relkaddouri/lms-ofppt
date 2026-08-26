import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * Confirmation d'un lien envoyé par email (connexion sans mot de passe,
 * confirmation d'adresse, réinitialisation). Échange le jeton à usage unique
 * contre une session déposée en cookie, puis redirige.
 *
 * Motif standard Supabase SSR. Nécessaire dès que des comptes sont créés par
 * invitation plutôt que par saisie de mot de passe.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const suite = searchParams.get("next") ?? "/dashboard";

  const echec = (message: string) =>
    NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`);

  if (!tokenHash || !type) {
    return echec("Lien de connexion incomplet.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    console.error("auth/confirm:", error.message);
    return echec("Ce lien de connexion est invalide ou expiré.");
  }

  // `suite` est contraint à un chemin interne : jamais de redirection ouverte.
  const destination = suite.startsWith("/") && !suite.startsWith("//") ? suite : "/dashboard";
  return NextResponse.redirect(`${origin}${destination}`);
}
