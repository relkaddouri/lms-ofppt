import { FileCheck2 } from "lucide-react";
import EnConstruction from "../EnConstruction";

export const metadata = { title: "Contrôles" };

export default function ControlesPage() {
  return (
    <EnConstruction
      titre="Contrôles"
      description="Les contrôles de votre groupe, module par module, et vos résultats."
      Icone={FileCheck2}
    />
  );
}
