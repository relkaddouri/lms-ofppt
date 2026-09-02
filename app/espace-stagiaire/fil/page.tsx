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
    <div className="bg-surface md:overflow-hidden md:rounded-[14px] md:border md:border-border">
      <div className="flex flex-col gap-1.5 px-5 pb-2.5 pt-[22px]">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          Fil du groupe
        </span>
        <h1 className="font-display text-[26px] font-bold leading-tight tracking-[-0.02em] text-ink">
          Annonces
        </h1>
      </div>

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
