import { getGroupeById } from "@/app/actions/groupes";
import { getStagiairesCount } from "@/app/actions/stagiaires";
import { getAnnoncesByGroupe } from "@/app/actions/annonces";
import { redirect } from "next/navigation";
import AnnoncesManager from "./AnnoncesManager";
import GroupeHeader from "@/components/GroupeHeader";
import GroupeTabs from "@/components/GroupeTabs";

export default async function AnnoncesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const groupe = await getGroupeById(id);
  if (!groupe) redirect("/groupes");

  const [annonces, stagiairesCount] = await Promise.all([
    getAnnoncesByGroupe(id),
    getStagiairesCount(id),
  ]);

  return (
    <div className="p-8">
      <GroupeHeader groupe={groupe} stagiairesCount={stagiairesCount} />
      <GroupeTabs />
      <AnnoncesManager groupeId={id} annonces={annonces} />
    </div>
  );
}
