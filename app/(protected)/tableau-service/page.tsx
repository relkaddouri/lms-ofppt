import { getUser } from "@/lib/supabase/server";
import { getTableauService } from "@/app/actions/tableau-service";
import TableauService from "./TableauService";

export const metadata = { title: "Tableau de service" };

export default async function TableauServicePage() {
  const [lignes, user] = await Promise.all([getTableauService(), getUser()]);

  return <TableauService lignes={lignes} formateur={user?.email ?? "Formateur"} />;
}
