import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "@/lib/supabase/service";
import { urlEffective, type Fournisseur } from "@/lib/llm-catalogue";

/**
 * Point d'entrée unique pour tout appel à un modèle de langage.
 *
 * Les quatre routes qui génèrent ou corrigent passent par ici. Le fournisseur
 * n'est pas figé dans le code : il vient des paramètres du formateur, et la
 * clé est déchiffrée depuis Vault au moment de l'appel, jamais avant.
 */

export class ErreurLlm extends Error {
  constructor(
    message: string,
    readonly statut = 502,
  ) {
    super(message);
    this.name = "ErreurLlm";
  }
}

export type ConfigLlm = {
  fournisseur: Fournisseur;
  modele: string;
  baseUrl: string | null;
  maxTokens: number;
  temperature: number | null;
  cle: string;
};

type LigneCle = {
  fournisseur: Fournisseur;
  modele: string;
  base_url: string | null;
  max_tokens: number;
  temperature: number | null;
  cle: string | null;
};

/**
 * Relit la configuration du formateur et déchiffre sa clé.
 *
 * Passe par le client service : `lire_cle_llm` est révoquée pour les rôles
 * anon et authenticated, elle n'est exécutable que côté serveur.
 */
export async function chargerConfigLlm(formateurId: string): Promise<ConfigLlm> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("lire_cle_llm", {
    p_formateur: formateurId,
  });

  if (error) {
    console.error("[llm] lecture des paramètres", error);
    throw new ErreurLlm("Impossible de lire vos paramètres de modèle.", 500);
  }

  const ligne = (data as unknown as LigneCle[] | null)?.[0];
  if (!ligne) {
    throw new ErreurLlm(
      "Aucun modèle configuré. Renseignez un fournisseur dans Paramètres.",
      412,
    );
  }
  if (!ligne.cle) {
    throw new ErreurLlm(
      "Aucune clé API enregistrée. Ajoutez-la dans Paramètres.",
      412,
    );
  }

  return {
    fournisseur: ligne.fournisseur,
    modele: ligne.modele,
    baseUrl: urlEffective(ligne.fournisseur, ligne.base_url),
    maxTokens: ligne.max_tokens,
    temperature: ligne.temperature,
    cle: ligne.cle,
  };
}

export type AppelLlm = {
  /** Consigne de rôle, mise en cache côté fournisseur quand c'est possible. */
  systeme?: string;
  prompt: string;
  /**
   * Température souhaitée par l'appelant. Une correction de copie doit rester
   * déterministe, une génération peut respirer — c'est au site d'appel de le
   * dire. Le réglage du formateur ne sert que de valeur par défaut.
   */
  temperature?: number;
  maxTokens?: number;
  /** Exiger un objet JSON en sortie. */
  json?: boolean;
};

export async function appelerLlm(
  config: ConfigLlm,
  appel: AppelLlm,
): Promise<string> {
  const maxTokens = Math.min(appel.maxTokens ?? config.maxTokens, config.maxTokens);
  return config.fournisseur === "anthropic"
    ? appelerAnthropic(config, appel, maxTokens)
    : appelerCompatibleOpenai(config, appel, maxTokens);
}

// ---------------------------------------------------------------------------
// Claude — SDK officiel Anthropic.
// ---------------------------------------------------------------------------

/** Les modèles pour lesquels le repli serveur en cas de refus est disponible. */
function accepteRepli(modele: string): boolean {
  return /^claude-(opus-5|fable-5|mythos-5)\b/.test(modele);
}

async function appelerAnthropic(
  config: ConfigLlm,
  appel: AppelLlm,
  maxTokens: number,
): Promise<string> {
  const client = new Anthropic({ apiKey: config.cle });

  // Le JSON n'a pas de mode dédié ici : on le demande dans la consigne, et la
  // route valide ensuite ce qu'elle reçoit — ce qu'elle doit faire de toute
  // façon, quel que soit le fournisseur.
  const systeme = [
    appel.systeme,
    appel.json
      ? "Réponds uniquement par un objet JSON valide, sans texte autour et sans bloc de code."
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    // Diffusion systématique : le formateur peut régler max_tokens très haut,
    // et une requête non diffusée finirait en délai dépassé.
    const flux = client.beta.messages.stream({
      model: config.modele,
      max_tokens: maxTokens,
      thinking: { type: "adaptive" },
      ...(systeme ? { system: systeme } : {}),
      messages: [{ role: "user", content: appel.prompt }],
      ...(accepteRepli(config.modele)
        ? {
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default" as const,
          }
        : {}),
    });
    const reponse = await flux.finalMessage();

    if (reponse.stop_reason === "refusal") {
      throw new ErreurLlm(
        "Le modèle a refusé de traiter cette demande. Reformulez la consigne.",
        422,
      );
    }

    const texte = reponse.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    if (!texte) {
      throw new ErreurLlm("Le modèle n'a rien retourné.");
    }
    return texte;
  } catch (e) {
    throw traduireErreur(e);
  }
}

function traduireErreur(e: unknown): ErreurLlm {
  if (e instanceof ErreurLlm) return e;
  if (e instanceof Anthropic.AuthenticationError) {
    return new ErreurLlm("Clé API Anthropic refusée. Vérifiez-la dans Paramètres.", 401);
  }
  if (e instanceof Anthropic.RateLimitError) {
    return new ErreurLlm("Quota Anthropic atteint. Réessayez dans un moment.", 429);
  }
  if (e instanceof Anthropic.NotFoundError) {
    return new ErreurLlm(
      "Ce modèle n'existe pas ou n'est pas accessible avec votre clé.",
      404,
    );
  }
  if (e instanceof Anthropic.APIError) {
    console.error("[llm] anthropic", e.status, e.message);
    return new ErreurLlm(`Appel au modèle refusé (${e.status}).`);
  }
  console.error("[llm] inattendu", e);
  return new ErreurLlm("Appel au modèle impossible.");
}

// ---------------------------------------------------------------------------
// OpenAI, DeepSeek, et tout service exposant la même forme.
// ---------------------------------------------------------------------------

async function appelerCompatibleOpenai(
  config: ConfigLlm,
  appel: AppelLlm,
  maxTokens: number,
): Promise<string> {
  if (!config.baseUrl) {
    throw new ErreurLlm("URL du service manquante dans vos paramètres.", 412);
  }

  const messages: { role: string; content: string }[] = [];
  if (appel.systeme) messages.push({ role: "system", content: appel.systeme });
  messages.push({ role: "user", content: appel.prompt });

  const temperature = appel.temperature ?? config.temperature ?? undefined;

  const res = await fetch(`${config.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.cle}`,
    },
    body: JSON.stringify({
      model: config.modele,
      messages,
      max_tokens: maxTokens,
      ...(temperature !== undefined ? { temperature } : {}),
      ...(appel.json ? { response_format: { type: "json_object" } } : {}),
    }),
  }).catch((e) => {
    console.error("[llm] réseau", e);
    throw new ErreurLlm("Service de modèle injoignable. Vérifiez l'URL.", 502);
  });

  const data = (await res.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  } | null;

  if (!res.ok) {
    console.error("[llm] compatible", res.status, data?.error?.message);
    if (res.status === 401 || res.status === 403) {
      throw new ErreurLlm("Clé API refusée. Vérifiez-la dans Paramètres.", 401);
    }
    if (res.status === 429) {
      throw new ErreurLlm("Quota atteint. Réessayez dans un moment.", 429);
    }
    throw new ErreurLlm(data?.error?.message ?? `Appel refusé (${res.status}).`);
  }

  const texte = data?.choices?.[0]?.message?.content?.trim();
  if (!texte) throw new ErreurLlm("Le modèle n'a rien retourné.");
  return texte;
}

// ---------------------------------------------------------------------------
// Test de connexion depuis la page Paramètres.
// ---------------------------------------------------------------------------

export type ResultatTest = { modeles: string[]; extrait: string };

/**
 * Vérifie qu'une clé fonctionne réellement, et relit la liste des modèles que
 * le compte peut utiliser — c'est plus fiable que de figer une liste dans le
 * code, qui vieillit à chaque sortie de modèle.
 */
export async function testerConnexion(config: ConfigLlm): Promise<ResultatTest> {
  const extrait = await appelerLlm(config, {
    prompt: "Réponds exactement : connexion établie.",
    maxTokens: 1000,
  });
  return { modeles: await listerModeles(config), extrait };
}

async function listerModeles(config: ConfigLlm): Promise<string[]> {
  try {
    if (config.fournisseur === "anthropic") {
      const client = new Anthropic({ apiKey: config.cle });
      const page = await client.models.list({ limit: 50 });
      return page.data.map((m) => m.id);
    }
    if (!config.baseUrl) return [];
    const res = await fetch(`${config.baseUrl.replace(/\/+$/, "")}/models`, {
      headers: { Authorization: `Bearer ${config.cle}` },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: { id?: string }[] };
    return (data.data ?? []).map((m) => m.id).filter((id): id is string => !!id);
  } catch {
    // La liste est un confort, pas le test lui-même : un service qui n'expose
    // pas /models reste parfaitement utilisable.
    return [];
  }
}
