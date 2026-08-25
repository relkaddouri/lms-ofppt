import { getGroupeById, getGroupeModules } from "@/app/actions/groupes";
import { getStagiairesCount } from "@/app/actions/stagiaires";
import { redirect } from "next/navigation";
import GroupeHeader from "@/components/GroupeHeader";
import GroupeTabs from "@/components/GroupeTabs";
import GroupModulesList from "../GroupModulesList";

export default async function FichesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const groupe = await getGroupeById(id);
  if (!groupe) redirect("/groupes");

  const [modules, stagiairesCount] = await Promise.all([
    getGroupeModules(id),
    getStagiairesCount(id),
  ]);

  return (
    <div className="p-8">
      <GroupeHeader groupe={groupe} stagiairesCount={stagiairesCount} />
      <GroupeTabs />
      <h2 className="mt-6 font-display text-xl font-bold text-ink">
        Fiches de préparation
      </h2>
      <GroupModulesList modules={modules} kind="fiches" groupeId={id} />
    </div>
  );
}
