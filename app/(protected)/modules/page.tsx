import { getModules, getCompetencesDisponibles } from "@/app/actions/modules";
import ModulesManager from "./ModulesManager";

export default async function ModulesPage() {
  const [modules, competences] = await Promise.all([
    getModules(),
    getCompetencesDisponibles(),
  ]);

  return <ModulesManager modules={modules} competences={competences} />;
}
