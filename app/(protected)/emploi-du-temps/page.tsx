import { getMotifs } from "@/app/actions/motifs";
import { getGroupes } from "@/app/actions/groupes";
import { getEtablissement } from "@/app/actions/etablissement";
import { getAnneeCourante } from "@/app/actions/annees";
import { getUser } from "@/lib/supabase/server";
import EmploiDuTempsManager from "./EmploiDuTempsManager";

export const metadata = { title: "Emploi du temps" };

export default async function EmploiDuTempsPage() {
  const [motifs, groupes, etablissement, annee, user] = await Promise.all([
    getMotifs(),
    getGroupes(),
    getEtablissement(),
    getAnneeCourante(),
    getUser(),
  ]);

  return (
    <EmploiDuTempsManager
      motifs={motifs}
      groupes={groupes}
      etablissement={etablissement}
      anneeScolaire={annee?.libelle ?? null}
      emailCompte={user?.email ?? "Formateur"}
    />
  );
}
