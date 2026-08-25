import { getModules } from "@/app/actions/modules";
import { getFichesVersions } from "@/app/actions/fiches";
import { redirect } from "next/navigation";
import FichePreparationManager from "./FichePreparationManager";

export default async function FichePreparationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const modules = await getModules();
  const module = modules.find((m) => m.id === id);
  if (!module) redirect("/modules");

  const versions = await getFichesVersions(id);

  return (
    <FichePreparationManager
      moduleId={id}
      moduleNom={module.nom}
      moduleDuree={module.duree_heures}
      versions={versions}
    />
  );
}
