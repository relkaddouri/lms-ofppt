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

  try {
    const { error } = await new Resend(cle).emails.send({
      from: process.env.RESEND_FROM ?? EXPEDITEUR_BAC_A_SABLE,
      to: a,
      subject: sujet,
      text: texte,
    });
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
