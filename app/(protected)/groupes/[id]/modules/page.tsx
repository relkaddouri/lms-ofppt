import { getGroupeModules } from "@/app/actions/groupes";
import GroupeModulesManager from "./GroupeModulesManager";

export default async function GroupeModulesPage({
  params,
}: PageProps<"/groupes/[id]/modules">) {
  const { id } = await params;
  const modules = await getGroupeModules(id);

  return <GroupeModulesManager groupeId={id} modules={modules} />;
}
