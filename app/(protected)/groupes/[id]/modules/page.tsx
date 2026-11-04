import { getGroupeModules, getModulesAAjouter } from "@/app/actions/groupes";
import GroupeModulesManager from "./GroupeModulesManager";

export default async function GroupeModulesPage({
  params,
}: PageProps<"/groupes/[id]/modules">) {
  const { id } = await params;
  const [modules, aAjouter] = await Promise.all([
    getGroupeModules(id),
    getModulesAAjouter(id),
  ]);

  return (
    <GroupeModulesManager groupeId={id} modules={modules} aAjouter={aAjouter} />
  );
}
