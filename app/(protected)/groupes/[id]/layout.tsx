import { getGroupeById } from "@/app/actions/groupes";
import { getStagiairesCount } from "@/app/actions/stagiaires";
import { redirect } from "next/navigation";
import GroupeHeader from "@/components/GroupeHeader";
import GroupeTabs from "@/components/GroupeTabs";

/**
 * Chargement unique du groupe pour tout /groupes/[id]/*.
 * Les sous-pages ne rechargent ni le groupe ni le compte de stagiaires
 * (conventions.md : « un layout partagé pour toute section de pages qui
 * répète le même chargement de données ou le même conteneur visuel »).
 */
export default async function GroupeLayout({
  children,
  params,
}: LayoutProps<"/groupes/[id]">) {
  const { id } = await params;

  const groupe = await getGroupeById(id);
  if (!groupe) redirect("/groupes");

  const stagiairesCount = await getStagiairesCount(id);

  return (
    <div className="p-8">
      <GroupeHeader groupe={groupe} stagiairesCount={stagiairesCount} />
      <GroupeTabs />
      {children}
    </div>
  );
}
