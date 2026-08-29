/**
 * Limite de débit en mémoire, par fenêtre glissante fixe.
 *
 * Implémentation unique pour tous les endpoints publics du projet
 * (conventions.md : « une seule implémentation par fonctionnalité transverse »).
 *
 * Limite connue : le compteur vit dans le processus. Derrière plusieurs
 * instances serverless, chaque instance a son propre compteur — la limite
 * effective est donc multipliée par le nombre d'instances. Suffisant pour
 * couper une boucle d'abus ; à remplacer par un store partagé (Redis, table
 * Postgres) le jour où le déploiement est réellement multi-instances.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

function purgeExpired(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();

  // Évite que la Map grossisse indéfiniment sur un serveur de longue durée.
  if (buckets.size > 500) purgeExpired(now);

  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Adresse cliente derrière un proxy. Next 16 n'expose plus `request.ip`. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() || "inconnu";
}

/** Réponse 429 normalisée, message destiné au stagiaire. */
export function tooManyRequests(retryAfterSeconds: number) {
  return new Response(
    JSON.stringify({
      error: `Trop de tentatives. Réessayez dans ${retryAfterSeconds} seconde(s).`,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSeconds),
      },
    },
  );
}

/**
 * Quotas des chemins qui déclenchent un appel facturé au modèle.
 *
 * Les endpoints ne sont plus publics depuis l'atome 4.1, mais l'authentification
 * ne borne pas la dépense : un compte légitime peut lancer autant d'appels qu'il
 * veut, et chacun est payé par le formateur. Ces quotas laissent passer un usage
 * normal — générer puis raffiner un contrôle plusieurs fois de suite — et
 * coupent la boucle ou la rafale.
 */
export const QUOTA_GENERATION = { limite: 20, fenetreMs: 10 * 60_000 };

/**
 * Une copie ne se corrige qu'une fois. Le verrou est posé par stagiaire ET par
 * contrôle : c'est ce qui empêche N requêtes simultanées de passer toutes le
 * contrôle d'unicité et de payer N corrections avant que la base n'en refuse
 * une seule.
 */
export const QUOTA_CORRECTION = { limite: 1, fenetreMs: 2 * 60_000 };

/** Garde-fou de rythme sur la remise elle-même, avant toute dépense. */
export const QUOTA_REMISE = { limite: 10, fenetreMs: 10 * 60_000 };

export type Quota = { limite: number; fenetreMs: number };

/**
 * Renvoie une réponse 429 prête à retourner, ou `null` si l'appel est autorisé.
 * Écrit une fois ici pour que les routes n'aient pas chacune leur variante.
 */
export function verifierQuota(cle: string, quota: Quota): Response | null {
  const resultat = rateLimit(cle, quota.limite, quota.fenetreMs);
  return resultat.allowed ? null : tooManyRequests(resultat.retryAfterSeconds);
}
