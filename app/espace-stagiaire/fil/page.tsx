import { Newspaper } from "lucide-react";
import EnConstruction from "../EnConstruction";

export const metadata = { title: "Fil" };

export default function FilPage() {
  return (
    <EnConstruction
      titre="Fil d'actualité"
      description="Les annonces de votre groupe apparaîtront ici, avec les commentaires de vos camarades."
      Icone={Newspaper}
    />
  );
}
