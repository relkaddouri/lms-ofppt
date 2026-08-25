import { getGroupeModules } from "@/app/actions/groupes";
import GroupModulesList from "../GroupModulesList";

export default async function FichesPage({
  params,
}: PageProps<"/groupes/[id]/fiches">) {
  const { id } = await params;
  const modules = await getGroupeModules(id);

  return (
    <>
      <h2 className="mt-6 font-display text-xl font-bold text-ink">
        Fiches de préparation
      </h2>
      <GroupModulesList modules={modules} kind="fiches" groupeId={id} />
    </>
  );
}
