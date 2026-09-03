import { getModules } from "@/app/actions/modules";
import { getGroupes, getSpecialites } from "@/app/actions/groupes";
import { getAnneeCourante } from "@/app/actions/annees";
import GroupesManager from "./GroupesManager";

export default async function GroupesPage() {
  const [groupes, modules, specialites, annee] = await Promise.all([
    getGroupes(),
    getModules(),
    getSpecialites(),
    getAnneeCourante(),
  ]);

  return (
    <GroupesManager
      groupes={groupes}
      modules={modules}
      specialites={specialites}
      anneeLibelle={annee ? annee.libelle.replace("/", " — ") : "non déclarée"}
    />
  );
}
