import { notFound } from "next/navigation";
import { getSeanceDetail } from "@/app/actions/seances";
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

  return <SeanceDetailView seance={seance} />;
}
