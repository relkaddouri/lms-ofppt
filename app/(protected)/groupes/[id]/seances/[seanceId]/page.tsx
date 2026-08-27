import { notFound } from "next/navigation";
import { getSeanceDetail } from "@/app/actions/seance";
import SeanceDetailView from "./SeanceDetailView";

export default async function SeancePage({
  params,
}: {
  params: Promise<{ id: string; seanceId: string }>;
}) {
  const { id, seanceId } = await params;
  const seance = await getSeanceDetail(seanceId);
  if (!seance || seance.groupe_id !== id) notFound();

  return <SeanceDetailView seance={seance} />;
}
