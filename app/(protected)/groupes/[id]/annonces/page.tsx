import { getAnnoncesByGroupe } from "@/app/actions/annonces";
import AnnoncesManager from "./AnnoncesManager";

export default async function AnnoncesPage({
  params,
}: PageProps<"/groupes/[id]/annonces">) {
  const { id } = await params;
  const annonces = await getAnnoncesByGroupe(id);

  return <AnnoncesManager groupeId={id} annonces={annonces} />;
}
