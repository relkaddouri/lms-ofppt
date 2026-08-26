import { getModules } from "@/app/actions/modules";
import { getControles } from "@/app/actions/controles";
import { redirect } from "next/navigation";
import CorrectionManager from "./CorrectionManager";

export default async function CorrectionPage({
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

  const controles = await getControles(groupe, id);

  return (
    <CorrectionManager
      moduleId={id}
      moduleNom={module.nom}
      controles={controles}
    />
  );
}
