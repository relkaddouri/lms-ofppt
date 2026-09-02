import { Newspaper } from "lucide-react";
import { getIdentiteStagiaire } from "@/app/actions/stagiaire";
import { getFil, getCamarades } from "@/app/actions/fil";
import CarteAnnonce from "./CarteAnnonce";
import EnConstruction from "../EnConstruction";

export const metadata = { title: "Fil" };

export default async function FilPage() {
  const identite = await getIdentiteStagiaire();
  // Le layout a déjà écarté les non-stagiaires ; ceci n'est qu'une garde.
  if (!identite) return null;

  const [annonces, camarades] = await Promise.all([
    getFil(identite.groupeId),
    getCamarades(identite.groupeId),
  ]);

  if (annonces.length === 0) {
    return (
      <EnConstruction
        titre="Aucune annonce"
        description="Les annonces de votre formateur apparaîtront ici. Vous pourrez y réagir et les commenter."
        Icone={Newspaper}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-[14px] border border-border bg-surface">
      {annonces.map((a) => (
        <CarteAnnonce key={a.id} annonce={a} camarades={camarades} />
      ))}
    </div>
  );
}
