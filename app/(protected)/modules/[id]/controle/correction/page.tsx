import { getModules } from "@/app/actions/modules";
import { getControles } from "@/app/actions/controles";
import { redirect } from "next/navigation";
import CorrectionManager from "./CorrectionManager";

export default async function CorrectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const modules = await getModules();
  const module = modules.find((m) => m.id === id);
  if (!module) redirect("/modules");

  const controles = await getControles(id);

  return (
    <CorrectionManager
      moduleId={id}
      moduleNom={module.nom}
      controles={controles}
    />
  );
}
