import { Newspaper } from "lucide-react";
import { getIdentiteStagiaire } from "@/app/actions/stagiaire";
import { getFil, getCamarades } from "@/app/actions/fil";
import { getIdentiteFormateur } from "@/app/actions/profil";
import CarteAnnonce from "./CarteAnnonce";
import EnConstruction from "../EnConstruction";
import EnTete from "../EnTete";

export const metadata = { title: "Fil" };

export default async function FilPage() {
  const identite = await getIdentiteStagiaire();
  // Le layout a déjà écarté les non-stagiaires ; ceci n'est qu'une garde.
  if (!identite) return null;

  const [annonces, camarades, formateur] = await Promise.all([
    getFil(identite.groupeId),
    getCamarades(identite.groupeId),
    // Mémorisée pour le rendu : `getFil` vient déjà de la demander.
    getIdentiteFormateur(),
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
    // Une carte par annonce, et non un seul bloc découpé par des filets.
    // Empilées sans respiration, les annonces se lisaient comme une liste de
    // courses : on ne voyait plus où l'une finissait et où la suivante
    // commençait, d'autant que chacune porte maintenant ses commentaires.
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <EnTete
        surtitre="Fil du groupe"
        titre="Annonces"
        dansCarte={false}
        resume={
          <>
            <span className="font-mono text-body">{annonces.length}</span>{" "}
            annonce{annonces.length > 1 ? "s" : ""} de{" "}
            {formateur.nom ?? "votre formateur"}
          </>
        }
      />

      {annonces.map((a) => (
        <CarteAnnonce
          key={a.id}
          annonce={a}
          camarades={camarades}
          formateur={formateur}
          moi={{
            nom: `${identite.prenom} ${identite.nom}`,
            photo: identite.photo,
            photoUrl: null,
            cestMoi: true,
          }}
        />
      ))}

      <div className="flex justify-center px-5 pb-2 pt-2">
        <span className="font-mono text-xs text-border-strong">
          Fin du fil · {annonces.length} annonce{annonces.length > 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}
