import { getModules } from "@/app/actions/modules";
import { getControles, getModuleAudit } from "@/app/actions/controles";
import { redirect } from "next/navigation";
import HistoriqueManager from "./HistoriqueManager";

export default async function HistoriquePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const modules = await getModules();
  const module = modules.find((m) => m.id === id);
  if (!module) redirect("/modules");

  const [controles, entries] = await Promise.all([
    getControles(id),
    getModuleAudit(id),
  ]);

  return (
    <HistoriqueManager
      moduleId={id}
      moduleNom={module.nom}
      controles={controles}
      entries={entries}
    />
  );
}
