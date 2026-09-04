import { notFound } from "next/navigation";
import { getSeanceDetail } from "@/app/actions/seances";
import ModeAnimation from "./ModeAnimation";

/**
 * Mode animation — la séance pendant qu'elle se déroule (PRD §4.3ter).
 *
 * Écran à part, hors de la page de séance : celle-ci sert à préparer et à
 * tenir le cahier, celui-ci sert à animer, debout devant une classe. Les deux
 * usages n'ont ni la même densité ni la même échelle de texte.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ id: string; seanceId: string }>;
}) {
  const { id, seanceId } = await params;
  const seance = await getSeanceDetail(seanceId, id);
  if (!seance) notFound();

  return <ModeAnimation seance={seance} groupeId={id} />;
}
