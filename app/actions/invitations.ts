"use server";

import { headers } from "next/headers";
import { createClient, getUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { envoyerCourriel } from "@/lib/courriel";
import { revalidatePath } from "next/cache";

/**
 * Invitation d'un stagiaire à créer son compte.
 *
 * La création d'un compte passe par l'API d'administration, donc par la clé de
 * service : elle ne peut pas se faire depuis le navigateur.
 *
 * Le lien partait au formateur et à lui seul, faute de serveur d'envoi. Ce
 * n'est plus vrai : le courriel part maintenant au stagiaire. Le lien
 * continue d'être rendu au formateur, mais comme un filet et non comme le
 * moyen principal — une adresse mal saisie ou une boîte pleine ne doit pas
 * laisser un stagiaire dehors.
 *
 * Ce que l'écran ne fera jamais : prétendre que le courriel est parti quand
 * il ne l'est pas. C'est tout l'objet du champ `envoi`.
 */

type StagiaireAInviter = {
  id: string;
  nom: string;
  prenom: string;
  email: string | null;
  user_id: string | null;
  groupe_id: string | null;
};

/**
 * L'origine des liens produits.
 *
 * Elle se lit dans la requête plutôt que dans une variable d'environnement :
 * un lien vers le mauvais port ou le mauvais domaine ne se remarque qu'au
 * moment où le stagiaire le suit, trop tard. La variable reste prioritaire
 * quand elle est posée, pour un déploiement derrière un proxy qui réécrit
 * l'hôte.
 */
async function origineDesLiens(): Promise<string> {
  const entetes = await headers();
  const hote = entetes.get("x-forwarded-host") ?? entetes.get("host");
  const protocole = entetes.get("x-forwarded-proto") ?? "http";
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    (hote ? `${protocole}://${hote}` : "http://localhost:3000")
  );
}

export type ResultatInvitation = {
  lien: string;
  email: string;
  /** Vrai si le compte existait déjà : le lien sert alors à le retrouver. */
  existant: boolean;
  /** Ce que le courriel a fait, mot pour mot, pour que l'écran le dise. */
  envoi: { envoye: true } | { envoye: false; raison: string };
};

/**
 * Ouvre le compte d'un stagiaire et lui envoie son lien.
 *
 * Extraite pour que l'envoi groupé emprunte exactement le même chemin que
 * l'envoi unitaire : deux implémentations auraient divergé au premier
 * correctif, et c'est précisément ce qui avait laissé l'invitation sans
 * courriel pendant que les annonces en avaient un.
 */
async function inviterUn(
  stagiaire: StagiaireAInviter,
  origine: string,
): Promise<ResultatInvitation> {
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
    .eq("id", stagiaire.id);
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

  const url = new URL("/auth/confirm", origine);
  url.searchParams.set("token_hash", lien.properties.hashed_token);
  url.searchParams.set("type", "recovery");
  url.searchParams.set("next", "/definir-mot-de-passe");

  const lienFinal = url.toString();

  // L'échec d'envoi n'annule pas l'invitation : le compte existe, le lien est
  // valide, et le formateur peut le transmettre à la main. Jeter ici obligerait
  // à tout recommencer pour un incident de messagerie.
  const envoi = await envoyerCourriel({
    a: email,
    sujet: existant
      ? "Votre accès à Pédago — nouveau lien"
      : "Votre accès à Pédago",
    texte: [
      `Bonjour ${stagiaire.prenom},`,
      ``,
      existant
        ? `Voici un nouveau lien pour accéder à votre espace Pédago et redéfinir votre mot de passe :`
        : `Un espace Pédago vous a été ouvert. Ce lien vous permet de choisir votre mot de passe :`,
      ``,
      lienFinal,
      ``,
      `Ce lien ouvre une session : ne le transmettez à personne.`,
      ``,
      `— Pédago`,
    ].join("\n"),
  });

  if (!envoi.envoye) {
    console.error("[invitation] courriel non parti", email, envoi.raison);
  }

  return { lien: lienFinal, email, existant, envoi };
}

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

  const resultat = await inviterUn(stagiaire, await origineDesLiens());
  revalidatePath(`/groupes/${stagiaire.groupe_id}`);
  return resultat;
}

/**
 * Traduit les échecs que le formateur peut corriger lui-même.
 *
 * Deux stagiaires qui partagent une adresse butent sur l'unicité de
 * `stagiaires.user_id` : un compte ne peut appartenir qu'à un seul. Le
 * message de Postgres nomme une contrainte, ce qui ne dit rien à qui doit
 * décider quoi faire. Les autres erreurs passent telles quelles — inventer un
 * texte rassurant sur une cause inconnue serait pire que la formulation
 * technique.
 */
function lisible(e: unknown): string {
  const brut = e instanceof Error ? e.message : "Envoi impossible.";
  if (brut.includes("stagiaires_user_id_key")) {
    return "Cette adresse est déjà rattachée à un autre stagiaire du groupe. Donnez-lui la sienne avant de renvoyer le lien.";
  }
  return brut;
}

export type ResultatInvitationGroupe = {
  /** Ceux qui ont reçu leur lien. */
  envoyes: string[];
  /** Ceux qui s'étaient déjà connectés — leur lien serait déjà consommé. */
  ignores: string[];
  /** Ceux qui n'ont rien reçu, et pourquoi. */
  echecs: { qui: string; email: string | null; raison: string }[];
};

/**
 * Envoie son lien d'accès à tout le groupe, en un geste.
 *
 * Trois règles, dans cet ordre :
 *
 * 1. On saute ceux qui se sont déjà connectés. Le signal est
 *    `last_sign_in_at` et non `user_id` : ce dernier ne dit que « invité », or
 *    un stagiaire invité mais jamais venu est exactement celui qu'il faut
 *    relancer.
 * 2. Chaque envoi est indépendant. Une adresse corrompue — la base en porte
 *    une, nom collé devant l'adresse — ferait échouer son propre envoi et rien
 *    d'autre. D'où le `try` par stagiaire plutôt qu'autour de la boucle.
 * 3. Les envois passent par `lib/courriel.ts`, donc par l'ordonnanceur : à
 *    deux par seconde, aucun 429 même sur un grand groupe. C'est aussi ce qui
 *    fixe la durée — comptez une demi-seconde par stagiaire à relancer.
 */
export async function inviterGroupe(
  groupeId: string,
): Promise<ResultatInvitationGroupe> {
  const formateur = await getUser();
  if (!formateur) throw new Error("Authentification requise.");

  // Sous l'identité du formateur : les policies interdisent de viser le
  // groupe d'un autre.
  const supabase = await createClient();
  const { data: stagiaires, error } = await supabase
    .from("stagiaires")
    .select("id, nom, prenom, email, user_id, groupe_id")
    .eq("groupe_id", groupeId)
    .order("nom");

  if (error) throw new Error(error.message);
  if (!stagiaires?.length) {
    return { envoyes: [], ignores: [], echecs: [] };
  }

  // Une seule lecture des comptes, plutôt qu'une par stagiaire.
  const service = createServiceClient();
  const { data: comptes } = await service.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const dejaVenus = new Set(
    (comptes?.users ?? [])
      .filter((u) => u.last_sign_in_at)
      .map((u) => u.id),
  );

  const origine = await origineDesLiens();
  const resultat: ResultatInvitationGroupe = {
    envoyes: [],
    ignores: [],
    echecs: [],
  };

  for (const s of stagiaires) {
    const qui = `${s.prenom} ${s.nom}`.trim();

    if (s.user_id && dejaVenus.has(s.user_id)) {
      resultat.ignores.push(qui);
      continue;
    }

    try {
      const envoi = await inviterUn(s, origine);
      if (envoi.envoi.envoye) resultat.envoyes.push(qui);
      else
        resultat.echecs.push({
          qui,
          email: s.email,
          raison: envoi.envoi.raison,
        });
    } catch (e) {
      resultat.echecs.push({ qui, email: s.email, raison: lisible(e) });
    }
  }

  revalidatePath(`/groupes/${groupeId}`);
  return resultat;
}
