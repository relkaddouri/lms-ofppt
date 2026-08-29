import { getGroupeModules } from "@/app/actions/groupes";
import { getContexteClasseur } from "@/app/actions/classeur";
import GroupModulesList from "../GroupModulesList";
import ExportClasseur from "./ExportClasseur";

export default async function FichesPage({
  params,
}: PageProps<"/groupes/[id]/fiches">) {
  const { id } = await params;
  const [modules, contexte] = await Promise.all([
    getGroupeModules(id),
    getContexteClasseur(id),
  ]);

  return (
    <>
      <h2 className="mt-6 font-display text-xl font-bold text-ink">
        Fiches de préparation
      </h2>
      <GroupModulesList modules={modules} kind="fiches" groupeId={id} />

      {contexte ? <ExportClasseur groupeId={id} contexte={contexte} /> : null}
    </>
  );
}
