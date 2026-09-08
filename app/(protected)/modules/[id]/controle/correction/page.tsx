import { getModules } from "@/app/actions/modules";
import { getControles, getPassations } from "@/app/actions/controles";
import { redirect } from "next/navigation";
import CorrectionManager from "./CorrectionManager";

export default async function CorrectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ groupe?: string; controle?: string; copie?: string }>;
}) {
  const [{ id }, recherche] = await Promise.all([params, searchParams]);

  const modules = await getModules();
  const module = modules.find((m) => m.id === id);
  if (!module) redirect("/modules");
  if (!recherche.groupe) redirect(`/modules/${id}`);

  const controles = await getControles(recherche.groupe, id);

  // Le contrôle demandé, sinon le premier qui a des copies à corriger.
  const controleId = recherche.controle ?? controles[0]?.id ?? null;
  const copies = controleId ? await getPassations(controleId) : [];

  return (
    <CorrectionManager
      moduleId={id}
      moduleNom={module.nom}
      moduleCode={module.code}
      groupeId={recherche.groupe}
      controles={controles}
      controleId={controleId}
      copies={copies}
      copieInitiale={recherche.copie ?? null}
    />
  );
}
