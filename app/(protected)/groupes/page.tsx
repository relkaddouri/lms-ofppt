import { getModules } from "@/app/actions/modules";
import { getGroupes } from "@/app/actions/groupes";
import GroupesManager from "./GroupesManager";

export default async function GroupesPage() {
  const [groupes, modules] = await Promise.all([getGroupes(), getModules()]);

  return <GroupesManager groupes={groupes} modules={modules} />;
}
