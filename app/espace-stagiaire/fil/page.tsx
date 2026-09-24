import { Newspaper } from "lucide-react";
import { getIdentiteStagiaire } from "@/app/actions/stagiaire";
import { getFil, getCamarades } from "@/app/actions/fil";
import CarteAnnonce from "./CarteAnnonce";
import EnConstruction from "../EnConstruction";
import EnTete from "../EnTete";

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
    <div className="bg-surface md:overflow-hidden md:rounded-[14px] md:border md:border-border">
      <EnTete
        surtitre="Fil du groupe"
        titre="Annonces"
        resume={
          <>
            <span className="font-mono text-body">{annonces.length}</span>{" "}
            annonce{annonces.length > 1 ? "s" : ""} de votre formateur
          </>
        }
      />

      {annonces.map((a) => (
        <CarteAnnonce key={a.id} annonce={a} camarades={camarades} />
      ))}

      <div className="flex justify-center border-t border-separator px-5 pb-2 pt-[26px]">
        <span className="font-mono text-xs text-border-strong">
          Fin du fil · {annonces.length} annonce{annonces.length > 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}
