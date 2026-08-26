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
    /**
     * Message brut du fournisseur. Une erreur de validation d'API dit
     * précisément ce qui cloche ; la masquer derrière « refusé (400) » rend la
     * panne indiagnosticable pour le formateur comme pour nous.
     */
    readonly detail?: string,
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

  // Diffusion systématique : le formateur peut régler max_tokens très haut,
  // et une requête non diffusée finirait en délai dépassé.
  const base = {
    model: config.modele,
    max_tokens: maxTokens,
    thinking: { type: "adaptive" as const },
    ...(systeme ? { system: systeme } : {}),
    messages: [{ role: "user" as const, content: appel.prompt }],
  };

  try {
    let reponse: Anthropic.Beta.BetaMessage;
    try {
      reponse = await client.beta.messages
        .stream({
          ...base,
          ...(accepteRepli(config.modele)
            ? {
                betas: ["server-side-fallback-2026-07-01"],
                fallbacks: "default" as const,
              }
            : {}),
        })
        .finalMessage();
    } catch (e) {
      // Le repli serveur en cas de refus n'est pas ouvert sur toutes les
      // organisations. S'il est rejeté, la génération doit continuer sans lui
      // plutôt que d'échouer sur une option de confort.
      const rejetOption =
        e instanceof Anthropic.APIError &&
        e.status === 400 &&
        /fallback|beta/i.test(e.message);
      if (!rejetOption) throw e;
      console.warn("[llm] repli serveur indisponible, appel sans option");
      reponse = await client.beta.messages.stream(base).finalMessage();
    }

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

/**
 * Extrait la phrase lisible d'une erreur Anthropic. `e.message` contient le
 * corps JSON complet, illisible dans une notification.
 */
function messageAnthropic(e: InstanceType<typeof Anthropic.APIError>): string {
  const enveloppe = e.error as { error?: { message?: string } } | undefined;
  return enveloppe?.error?.message ?? e.message;
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
    const detail = messageAnthropic(e);
    console.error("[llm] anthropic", e.status, detail);
    // Le solde épuisé est le cas le plus fréquent et le plus déroutant : la
    // clé est valide, l'authentification passe, et l'appel échoue quand même.
    if (/credit balance/i.test(detail)) {
      return new ErreurLlm(
        "Votre compte Anthropic n'a plus de crédit. Rechargez-le dans Plans & Billing, ou choisissez un autre fournisseur dans Paramètres.",
        402,
        detail,
      );
    }
    return new ErreurLlm(
      `Anthropic a refusé l'appel (${e.status}) : ${detail}`,
      e.status ?? 502,
      detail,
    );
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

  const url = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const corps: Record<string, unknown> = {
    model: config.modele,
    messages,
    max_tokens: maxTokens,
    ...(appel.json ? { response_format: { type: "json_object" } } : {}),
  };
  const temperature = appel.temperature ?? config.temperature ?? undefined;
  if (temperature !== undefined) corps.temperature = temperature;

  type ReponseCompatible = {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  } | null;

  async function envoyer(): Promise<{ status: number; data: ReponseCompatible }> {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.cle}`,
      },
      body: JSON.stringify(corps),
    }).catch((e) => {
      console.error("[llm] réseau", e);
      throw new ErreurLlm("Service de modèle injoignable. Vérifiez l'URL.", 502);
    });
    return { status: res.status, data: (await res.json().catch(() => null)) as ReponseCompatible };
  }

  let { status, data } = await envoyer();

  // Les modèles récents de plusieurs fournisseurs ont resserré ces deux
  // paramètres : max_tokens renommé, température figée. Le service dit
  // précisément lequel pose problème — autant le retirer et réessayer plutôt
  // que de renvoyer une erreur au formateur, qui n'y peut rien.
  for (let essai = 0; essai < 2 && status === 400; essai++) {
    const message = data?.error?.message ?? "";
    if (/max_tokens/i.test(message) && "max_tokens" in corps) {
      corps.max_completion_tokens = corps.max_tokens;
      delete corps.max_tokens;
      console.warn("[llm] max_tokens refusé, bascule sur max_completion_tokens");
    } else if (/temperature/i.test(message) && "temperature" in corps) {
      delete corps.temperature;
      console.warn("[llm] température refusée, appel sans température");
    } else {
      break;
    }
    ({ status, data } = await envoyer());
  }

  if (status < 200 || status >= 300) {
    const message = data?.error?.message;
    console.error("[llm] compatible", status, message);
    if (status === 401 || status === 403) {
      throw new ErreurLlm(
        `Clé API refusée${message ? ` : ${message}` : ""}`,
        401,
        message,
      );
    }
    if (status === 429) {
      throw new ErreurLlm("Quota atteint. Réessayez dans un moment.", 429, message);
    }
    throw new ErreurLlm(
      message ? `Le service a refusé l'appel (${status}) : ${message}` : `Appel refusé (${status}).`,
      status,
      message,
    );
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
