import { getModuleDetail } from "@/app/actions/modules";
import { getGroupeById } from "@/app/actions/groupes";
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

  const detail = await getModuleDetail(id);
  if (!detail) redirect("/modules");

  // Un contrôle appartient à un couple groupe+module : sans groupe, on renvoie
  // vers la fiche du module, qui liste les groupes concernés.
  if (!groupe) redirect(`/modules/${id}`);

  const [groupeDetail, controles] = await Promise.all([
    getGroupeById(groupe),
    getControles(groupe, id),
  ]);
  if (!groupeDetail) redirect(`/modules/${id}`);

  return (
    <ControleManager
      moduleId={id}
      moduleNom={detail.module.nom}
      moduleDuree={detail.module.duree_reference}
      moduleCode={detail.competence?.code_operationnel ?? null}
      groupeId={groupe}
      groupeNom={groupeDetail.nom}
      controles={controles}
    />
  );
}
