"use server";

import { headers } from "next/headers";
import { createClient, getUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { revalidatePath } from "next/cache";

/**
 * Invitation d'un stagiaire à créer son compte.
 *
 * La création d'un compte passe par l'API d'administration, donc par la clé de
 * service : elle ne peut pas se faire depuis le navigateur. Le lien est rendu
 * au formateur plutôt qu'envoyé par courriel — l'application n'a pas de
 * serveur d'envoi configuré, et un lien qu'on transmet soi-même vaut mieux
 * qu'un courriel qui échoue en silence.
 */

export type ResultatInvitation = {
  lien: string;
  email: string;
  /** Vrai si le compte existait déjà : le lien sert alors à le retrouver. */
  existant: boolean;
};

export async function inviterStagiaire(
  stagiaireId: string,
): Promise<ResultatInvitation> {
  const formateur = await getUser();
  if (!formateur) throw new Error("Authentification requise.");

  // Lecture sous l'identité du formateur : les policies garantissent qu'il ne
  // peut inviter qu'un stagiaire de ses propres groupes.
  const supabase = await createClient();
  const { data: stagiaire, error } = await supabase
    .from("stagiaires")
    .select("id, nom, prenom, email, user_id, groupe_id")
    .eq("id", stagiaireId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!stagiaire) {
    throw new Error("Stagiaire introuvable, ou hors de vos groupes.");
  }
  if (!stagiaire.email?.trim()) {
    throw new Error(
      `${stagiaire.prenom} ${stagiaire.nom} n'a pas d'adresse e-mail : ajoutez-la avant d'inviter.`,
    );
  }

  const email = stagiaire.email.trim().toLowerCase();
  const service = createServiceClient();

  // Le compte peut déjà exister — invitation renvoyée, ou adresse déjà connue
  // pour un autre usage. On le retrouve plutôt que d'échouer.
  let userId = stagiaire.user_id as string | null;
  let existant = Boolean(userId);

  if (!userId) {
    const { data: cree, error: errCreate } = await service.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { nom: stagiaire.nom, prenom: stagiaire.prenom },
    });

    if (errCreate) {
      const { data: liste } = await service.auth.admin.listUsers();
      const trouve = liste?.users.find((u) => u.email?.toLowerCase() === email);
      if (!trouve) throw new Error(errCreate.message);
      userId = trouve.id;
      existant = true;
    } else {
      userId = cree.user.id;
    }
  }

  const { error: errProfil } = await service
    .from("profils")
    .upsert({ id: userId, role: "stagiaire" }, { onConflict: "id" });
  if (errProfil) throw new Error(errProfil.message);

  const { error: errLien } = await service
    .from("stagiaires")
    .update({ user_id: userId })
    .eq("id", stagiaireId);
  if (errLien) throw new Error(errLien.message);

  // Lien de définition de mot de passe : le stagiaire choisit le sien, le
  // formateur n'en connaît jamais aucun.
  const { data: lien, error: errGen } = await service.auth.admin.generateLink({
    type: "recovery",
    email,
  });
  if (errGen || !lien?.properties?.hashed_token) {
    throw new Error(errGen?.message ?? "Lien d'invitation impossible à produire.");
  }

  // L'origine se lit dans la requête plutôt que dans une variable
  // d'environnement : un lien vers le mauvais port ou le mauvais domaine ne se
  // remarque qu'au moment où le stagiaire le suit, trop tard. La variable
  // reste prioritaire quand elle est posée, pour un déploiement derrière un
  // proxy qui réécrit l'hôte.
  const entetes = await headers();
  const hote = entetes.get("x-forwarded-host") ?? entetes.get("host");
  const protocole = entetes.get("x-forwarded-proto") ?? "http";
  const origine =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (hote ? `${protocole}://${hote}` : "http://localhost:3000");
  const url = new URL("/auth/confirm", origine);
  url.searchParams.set("token_hash", lien.properties.hashed_token);
  url.searchParams.set("type", "recovery");
  url.searchParams.set("next", "/definir-mot-de-passe");

  revalidatePath(`/groupes/${stagiaire.groupe_id}`);

  return { lien: url.toString(), email, existant };
}
