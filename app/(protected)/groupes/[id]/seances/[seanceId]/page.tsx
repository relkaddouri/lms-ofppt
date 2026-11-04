import { notFound } from "next/navigation";
import { getSeanceDetail, getSeancesVoisines } from "@/app/actions/seances";
import SeanceDetailView from "./SeanceDetailView";

export default async function SeancePage({
  params,
}: {
  params: Promise<{ id: string; seanceId: string }>;
}) {
  const { id, seanceId } = await params;
  // La lecture est bornée au groupe de l'URL : une séance d'un autre groupe
  // ne remonte tout simplement pas.
  const seance = await getSeanceDetail(seanceId, id);
  if (!seance) notFound();

  const voisines = await getSeancesVoisines(id, seance.date, seance.heure_debut);

  return <SeanceDetailView seance={seance} voisines={voisines} />;
}
