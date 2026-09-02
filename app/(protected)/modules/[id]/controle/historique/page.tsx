import { getModules } from "@/app/actions/modules";
import { getControles, getModuleAudit } from "@/app/actions/controles";
import { redirect } from "next/navigation";
import HistoriqueManager from "./HistoriqueManager";

export default async function HistoriquePage({
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
  if (!groupe) redirect(`/modules/${id}`);

  const [controles, entries] = await Promise.all([
    getControles(groupe, id),
    getModuleAudit(groupe, id),
  ]);

  return (
    <HistoriqueManager
      moduleId={id}
      moduleNom={module.nom}
      moduleCode={module.code}
      controles={controles}
      entries={entries}
    />
  );
}
