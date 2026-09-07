import { getStagiairesByGroupe } from "@/app/actions/stagiaires";
import GroupeDetail from "./GroupeDetail";

/**
 * « Envoyer le lien à tout le monde » dure plus longtemps que la limite par
 * défaut de la plateforme.
 *
 * Mesuré : 13,8 s pour un groupe de quinze. C'est irréductible — Resend
 * accepte deux envois par seconde, et l'ordonnanceur de `lib/courriel.ts` s'y
 * tient exprès. Sans ce réglage, l'action serait coupée en vol sur un groupe
 * entier, après avoir envoyé une partie des liens et sans rien dire.
 *
 * Le réglage se pose au niveau de la page et non de l'action : c'est ce
 * qu'indique la référence `maxDuration` livrée dans `node_modules/next`.
 */
export const maxDuration = 60;

export default async function GroupeDetailPage({
  params,
}: PageProps<"/groupes/[id]">) {
  const { id } = await params;
  const stagiaires = await getStagiairesByGroupe(id);

  return <GroupeDetail groupeId={id} stagiaires={stagiaires} />;
}
