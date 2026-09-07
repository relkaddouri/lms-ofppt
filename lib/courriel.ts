import { Resend } from "resend";

/**
 * Envoi de courriel — une seule implémentation (conventions.md).
 *
 * Il y en avait zéro et demie : les annonces appelaient Resend directement,
 * l'invitation d'un stagiaire n'envoyait rien du tout et rendait le lien au
 * formateur, en expliquant que « l'application n'a pas de serveur d'envoi
 * configuré ». C'était vrai quand la phrase a été écrite.
 *
 * Le piège que ce module ferme : `resend.emails.send()` ne jette pas. Un
 * domaine non vérifié, une clé révoquée, une adresse refusée reviennent dans
 * `{ error }` d'une promesse tenue. Le code des annonces comptait les
 * promesses rejetées — il n'en voyait donc aucune, et signalait un succès sur
 * chaque échec d'API.
 *
 * L'audit du tableau de bord Resend a montré ce que ça coûtait : sur un envoi
 * d'annonce à quinze stagiaires, quatre requêtes ont été refusées en 429 et
 * l'écran a affiché un succès. Rendre l'échec visible ne suffisait donc pas —
 * il fallait cesser de le provoquer. D'où l'ordonnanceur ci-dessous.
 */

export type ResultatEnvoi =
  | { envoye: true }
  /** `raison` est destinée à l'utilisateur : elle est lisible, pas technique. */
  | { envoye: false; raison: string };

/**
 * L'expéditeur de repli est le bac à sable de Resend, qui ne délivre qu'à
 * l'adresse du titulaire du compte. Utile en développement, inutilisable pour
 * écrire à un stagiaire — d'où l'avertissement plutôt qu'un envoi silencieux
 * qui n'arrive nulle part.
 */
const EXPEDITEUR_BAC_A_SABLE = "Pédago <onboarding@resend.dev>";

export function courrielConfigure(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
}

// ── Ordonnanceur ──────────────────────────────────────────────────────────

/**
 * Resend accepte deux requêtes par seconde. Un envoi de groupe les tirait
 * toutes d'un coup.
 */
const INTERVALLE_MS = 500;

/**
 * Date du prochain créneau libre.
 *
 * Chaque appel réserve le sien puis avance le curseur, avant toute attente :
 * JavaScript n'interrompt pas une fonction entre deux instructions
 * synchrones, donc deux appels concurrents ne peuvent pas réserver le même
 * créneau. C'est ce qui rend l'étalement correct sous `Promise.all`, sans
 * verrou ni file explicite.
 *
 * La portée est le processus. Sur Vercel, un envoi de groupe tient dans une
 * seule invocation, donc le compte est juste ; deux requêtes servies par deux
 * instances pourraient encore se croiser. C'est le repli sur 429 ci-dessous
 * qui couvre ce reste.
 */
let prochainCreneau = 0;

async function attendreSonTour(): Promise<void> {
  const maintenant = Date.now();
  const creneau = Math.max(maintenant, prochainCreneau);
  prochainCreneau = creneau + INTERVALLE_MS;
  const attente = creneau - maintenant;
  if (attente > 0) await new Promise((r) => setTimeout(r, attente));
}

/** Nombre de secondes à patienter, lu dans l'en-tête quand Resend le donne. */
function delaiDeReprise(entetes: Record<string, string> | null): number {
  const brut = entetes?.["retry-after"] ?? entetes?.["Retry-After"];
  const secondes = brut ? Number(brut) : NaN;
  return Number.isFinite(secondes) && secondes > 0
    ? Math.min(secondes * 1000, 5000)
    : 1000;
}

export async function envoyerCourriel({
  a,
  sujet,
  texte,
}: {
  a: string;
  sujet: string;
  texte: string;
}): Promise<ResultatEnvoi> {
  const cle = process.env.RESEND_API_KEY;
  if (!cle) {
    return { envoye: false, raison: "Aucun service d'envoi n'est configuré." };
  }
  if (!process.env.RESEND_FROM) {
    return {
      envoye: false,
      raison:
        "Aucune adresse d'expédition n'est configurée : sans elle, Resend n'écrit qu'au titulaire du compte.",
    };
  }

  const resend = new Resend(cle);
  const envoi = () =>
    resend.emails.send({
      from: process.env.RESEND_FROM ?? EXPEDITEUR_BAC_A_SABLE,
      to: a,
      subject: sujet,
      text: texte,
    });

  try {
    await attendreSonTour();
    let { error, headers } = await envoi();

    // Ceinture et bretelles : l'étalement ne connaît que ce processus. Si la
    // limite tombe quand même — deux instances servies en parallèle — un seul
    // second essai suffit, la fenêtre de Resend étant d'une seconde.
    if (error?.name === "rate_limit_exceeded" || error?.statusCode === 429) {
      await new Promise((r) => setTimeout(r, delaiDeReprise(headers)));
      await attendreSonTour();
      ({ error, headers } = await envoi());
    }

    // Le cas qui manquait : une erreur d'API arrive ici, pas dans le `catch`.
    if (error) return { envoye: false, raison: error.message };
    return { envoye: true };
  } catch (e) {
    return {
      envoye: false,
      raison: e instanceof Error ? e.message : "Envoi impossible.",
    };
  }
}
