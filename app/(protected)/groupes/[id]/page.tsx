import { getGroupeById } from "@/app/actions/groupes";
import { getStagiairesByGroupe, getStagiairesCount } from "@/app/actions/stagiaires";
import { redirect } from "next/navigation";
import GroupeDetail from "./GroupeDetail";
import GroupeHeader from "@/components/GroupeHeader";
import GroupeTabs from "@/components/GroupeTabs";

export default async function GroupeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const groupe = await getGroupeById(id);
  if (!groupe) redirect("/groupes");

  const [stagiaires, stagiairesCount] = await Promise.all([
    getStagiairesByGroupe(id),
    getStagiairesCount(id),
  ]);

  return (
    <div className="p-8">
      <GroupeHeader groupe={groupe} stagiairesCount={stagiairesCount} />
      <GroupeTabs />
      <GroupeDetail groupe={groupe} stagiaires={stagiaires} />
    </div>
  );
}
