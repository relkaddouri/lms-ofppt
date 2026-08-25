import { getModules } from "@/app/actions/modules";
import { getControles } from "@/app/actions/controles";
import { redirect } from "next/navigation";
import ControleManager from "./ControleManager";

export default async function ControlePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ groupe?: string }>;
}) {
  const [{ id }, { groupe }] = await Promise.all([params, searchParams]);

  const modules = await getModules();
  const module = modules.find((m) => m.id === id);
  if (!module) redirect("/modules");

  const controles = await getControles(id);

  return (
    <ControleManager
      moduleId={id}
      moduleNom={module.nom}
      moduleDuree={module.duree_heures}
      groupeId={groupe ?? null}
      controles={controles}
    />
  );
}
