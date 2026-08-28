import { getDevoirsGroupe } from "@/app/actions/devoirs";
import { getGroupeModules } from "@/app/actions/groupes";
import DevoirsManager from "./DevoirsManager";

export default async function DevoirsGroupePage({
  params,
}: PageProps<"/groupes/[id]/devoirs">) {
  const { id } = await params;
  const [devoirs, modules] = await Promise.all([
    getDevoirsGroupe(id),
    getGroupeModules(id),
  ]);

  return <DevoirsManager groupeId={id} devoirs={devoirs} modules={modules} />;
}
