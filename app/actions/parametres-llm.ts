"use server";

import { createClient, getUser } from "@/lib/supabase/server";
import { chargerConfigLlm, testerConnexion, ErreurLlm } from "@/lib/llm";
import { fournisseur as decrire, type Fournisseur } from "@/lib/llm-catalogue";
import { revalidatePath } from "next/cache";

export type ParametresLlm = {
  fournisseur: Fournisseur;
  modele: string;
  base_url: string | null;
  max_tokens: number;
  temperature: number | null;
  /** La clé elle-même n'est jamais renvoyée au navigateur. */
  cle_definie: boolean;
  updated_at: string;
};

/**
 * Traduit une erreur de base en message lisible.
 *
 * conventions.md L.39 : une erreur technique brute ne doit jamais être montrée
 * au formateur. Un « duplicate key value violates unique constraint » dans une
 * notification ne lui apprend rien et ne lui dit pas quoi faire.
 */
function messageLisible(erreur: { message: string; code?: string }): string {
  console.error("[parametres-llm]", erreur.code, erreur.message);
  if (/duplicate key|secrets_name_idx/i.test(erreur.message)) {
    return "Une clé était déjà enregistrée dans un état incohérent. Supprimez-la, puis saisissez-la de nouveau.";
  }
  if (/Authentification requise/i.test(erreur.message)) {
    return "Votre session a expiré. Reconnectez-vous.";
  }
  if (/violates check constraint/i.test(erreur.message)) {
    return "Une des valeurs saisies est hors des limites autorisées.";
  }
  return "Enregistrement impossible. Réessayez, ou contactez l'administrateur si cela persiste.";
}

export async function getParametresLlm(): Promise<ParametresLlm | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lire_parametres_llm");
  if (error) throw new Error(messageLisible(error));
  return ((data as unknown as ParametresLlm[] | null) ?? [])[0] ?? null;
}

export type SaisieParametresLlm = {
  fournisseur: Fournisseur;
  modele: string;
  base_url: string | null;
  /** Vide = conserver la clé déjà enregistrée. */
  cle: string;
  max_tokens: number;
  temperature: number | null;
};

export async function saveParametresLlm(input: SaisieParametresLlm) {
  const description = decrire(input.fournisseur);
  if (!description) throw new Error("Fournisseur inconnu.");

  const modele = input.modele.trim();
  if (!modele) throw new Error("Indiquez le modèle à utiliser.");

  const baseUrl = input.base_url?.trim() || null;
  if (input.fournisseur === "compatible") {
    if (!baseUrl) throw new Error("Indiquez l'URL du service.");
    if (!/^https?:\/\//i.test(baseUrl)) {
      throw new Error("L'URL doit commencer par http:// ou https://.");
    }
  }

  if (!Number.isFinite(input.max_tokens) || input.max_tokens < 256 || input.max_tokens > 128000) {
    throw new Error("Le nombre de jetons doit être compris entre 256 et 128000.");
  }
  if (input.temperature !== null && (input.temperature < 0 || input.temperature > 2)) {
    throw new Error("La température doit être comprise entre 0 et 2.");
  }

  const cle = input.cle.trim();
  // Une clé collée avec des espaces ou tronquée est la panne la plus fréquente :
  // autant la refuser ici plutôt que de laisser l'appel échouer en 401.
  if (cle && description.prefixeCle && !cle.startsWith(description.prefixeCle)) {
    throw new Error(
      `Une clé ${description.nom} commence normalement par « ${description.prefixeCle} ».`,
    );
  }
  if (!cle) {
    const existant = await getParametresLlm();
    if (!existant?.cle_definie) throw new Error("Renseignez votre clé API.");
    // Conserver une clé DeepSeek en basculant sur Claude produirait un 401 à
    // la première génération, sans que rien n'ait signalé le problème ici.
    if (existant.fournisseur !== input.fournisseur) {
      throw new Error(
        `La clé enregistrée est une clé ${decrire(existant.fournisseur)?.nom ?? existant.fournisseur}. Saisissez une clé ${description.nom}.`,
      );
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("enregistrer_parametres_llm", {
    p_fournisseur: input.fournisseur,
    p_modele: modele,
    p_base_url: baseUrl ?? undefined,
    // La fonction distingue « paramètre absent » de « valeur nulle » : passer
    // `null` là où elle attend un défaut la ferait échouer.
    p_cle: cle || undefined,
    p_max_tokens: Math.round(input.max_tokens),
    p_temperature: description.temperature
      ? (input.temperature ?? undefined)
      : undefined,
  });
  if (error) throw new Error(messageLisible(error));

  revalidatePath("/parametres");
}

export async function deleteCleLlm() {
  const supabase = await createClient();
  const { error } = await supabase.rpc("supprimer_cle_llm");
  if (error) throw new Error(messageLisible(error));
  revalidatePath("/parametres");
}

export type ResultatTestLlm = {
  ok: boolean;
  message: string;
  modeles: string[];
};

/** Appelle réellement le fournisseur : c'est le seul test qui prouve quelque chose. */
export async function testerLlm(): Promise<ResultatTestLlm> {
  const user = await getUser();
  if (!user) throw new Error("Authentification requise.");

  try {
    const config = await chargerConfigLlm(user.id);
    const { modeles, extrait } = await testerConnexion(config);
    return {
      ok: true,
      message: `Connexion établie avec ${config.modele}. Réponse du modèle : « ${extrait.slice(0, 80)} »`,
      modeles,
    };
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof ErreurLlm
          ? e.message
          : e instanceof Error
            ? e.message
            : "Échec du test.",
      modeles: [],
    };
  }
}
