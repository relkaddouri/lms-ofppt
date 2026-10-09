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
    /*
      Vingt pour le formateur, là où le stagiaire en voit quatre : il gère ses
      annonces depuis la première liste, mais c'est ici qu'il lit ce qu'on lui
      a répondu, et quatre l'aveugleraient. Cet écran s'ouvre quelques fois par
      jour, pas des dizaines (audit du 09/10/2026).
    */
    getFil(id, 20),
    getCamarades(id),
  ]);

  return (
    <AnnoncesManager
      groupeId={id}
      annonces={annonces}
      fil={fil.annonces}
      camarades={camarades}
    />
  );
}
