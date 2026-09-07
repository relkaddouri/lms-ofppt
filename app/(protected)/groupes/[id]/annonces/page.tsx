import { getAnnoncesByGroupe } from "@/app/actions/annonces";
import { getFil, getCamarades } from "@/app/actions/fil";
import AnnoncesManager from "./AnnoncesManager";

export default async function AnnoncesPage({
  params,
}: PageProps<"/groupes/[id]/annonces">) {
  const { id } = await params;

  // `getFil` porte les commentaires que `getAnnoncesByGroupe` ignore. Les deux
  // lectures cohabitent : la première décrit l'annonce telle que le formateur
  // la gère (publier, supprimer), la seconde ce qu'on lui a répondu.
  const [annonces, fil, camarades] = await Promise.all([
    getAnnoncesByGroupe(id),
    getFil(id),
    getCamarades(id),
  ]);

  return (
    <AnnoncesManager
      groupeId={id}
      annonces={annonces}
      fil={fil}
      camarades={camarades}
    />
  );
}
