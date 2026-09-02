import { getModules } from "@/app/actions/modules";
import { getGroupes, getSpecialites } from "@/app/actions/groupes";
import GroupesManager from "./GroupesManager";

export default async function GroupesPage() {
  const [groupes, modules, specialites] = await Promise.all([
    getGroupes(),
    getModules(),
    getSpecialites(),
  ]);

  return (
    <GroupesManager
      groupes={groupes}
      modules={modules}
      specialites={specialites}
    />
  );
}
