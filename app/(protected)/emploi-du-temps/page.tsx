import { getMotifs } from "@/app/actions/motifs";
import { getGroupes } from "@/app/actions/groupes";
import EmploiDuTempsManager from "./EmploiDuTempsManager";

export const metadata = { title: "Emploi du temps" };

export default async function EmploiDuTempsPage() {
  const [motifs, groupes] = await Promise.all([getMotifs(), getGroupes()]);

  return <EmploiDuTempsManager motifs={motifs} groupes={groupes} />;
}
