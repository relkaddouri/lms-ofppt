import { getUser } from "@/lib/supabase/server";
import { getTableauService } from "@/app/actions/tableau-service";
import { getEtablissement } from "@/app/actions/etablissement";
import TableauService from "./TableauService";

export const metadata = { title: "Tableau de service" };

export default async function TableauServicePage() {
  const [lignes, user, etablissement] = await Promise.all([
    getTableauService(),
    getUser(),
    getEtablissement(),
  ]);

  return (
    <TableauService
      lignes={lignes}
      formateur={user?.email ?? "Formateur"}
      etablissement={etablissement}
    />
  );
}
