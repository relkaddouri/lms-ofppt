import { notFound } from "next/navigation";
import { getPlanification } from "@/app/actions/repartition";
import RepartitionManager from "./RepartitionManager";

export default async function PlanificationPage({
  params,
}: {
  params: Promise<{ id: string; moduleId: string }>;
}) {
  const { id, moduleId } = await params;
  const plan = await getPlanification(id, moduleId);
  if (!plan) notFound();

  return <RepartitionManager groupeId={id} moduleId={moduleId} plan={plan} />;
}
