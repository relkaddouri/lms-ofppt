import { getStagiairesByGroupe } from "@/app/actions/stagiaires";
import GroupeDetail from "./GroupeDetail";

export default async function GroupeDetailPage({
  params,
}: PageProps<"/groupes/[id]">) {
  const { id } = await params;
  const stagiaires = await getStagiairesByGroupe(id);

  return <GroupeDetail groupeId={id} stagiaires={stagiaires} />;
}
