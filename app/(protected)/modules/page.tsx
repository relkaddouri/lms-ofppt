import { getModules } from "@/app/actions/modules";
import ModulesManager from "./ModulesManager";

export default async function ModulesPage() {
  const modules = await getModules();

  return <ModulesManager modules={modules} />;
}
