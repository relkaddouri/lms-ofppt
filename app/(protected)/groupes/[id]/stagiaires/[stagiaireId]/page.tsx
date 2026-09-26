import { notFound } from "next/navigation";
import { getSuiviStagiaire, getLectureSuivi } from "@/app/actions/suivi";
import SuiviVue from "./SuiviVue";

export const metadata = { title: "Suivi du stagiaire" };

export default async function SuiviStagiairePage({
  params,
}: PageProps<"/groupes/[id]/stagiaires/[stagiaireId]">) {
  const { stagiaireId } = await params;
  const [suivi, lecture] = await Promise.all([
    getSuiviStagiaire(stagiaireId),
    getLectureSuivi(stagiaireId),
  ]);
  if (!suivi) notFound();

  return <SuiviVue suivi={suivi} lecture={lecture} />;
}
