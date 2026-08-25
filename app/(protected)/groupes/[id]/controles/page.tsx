import { getGroupeModules } from "@/app/actions/groupes";
import GroupModulesList from "../GroupModulesList";

export default async function ControlesPage({
  params,
}: PageProps<"/groupes/[id]/controles">) {
  const { id } = await params;
  const modules = await getGroupeModules(id);

  return (
    <>
      <h2 className="mt-6 font-display text-xl font-bold text-ink">Contrôles</h2>
      <GroupModulesList modules={modules} kind="controles" groupeId={id} />
    </>
  );
}
