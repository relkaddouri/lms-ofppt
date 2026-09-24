import { BookOpen } from "lucide-react";
import ListeModules from "./ListeModules";
import { getMesModulesCours } from "@/app/actions/cours-stagiaire";
import EnConstruction from "../EnConstruction";

export const metadata = { title: "Cours" };

/**
 * Les cours du stagiaire, module par module (PRD §4.5bis).
 *
 * Premier des trois niveaux du parcours : ses modules. On entre dans l'un
 * d'eux pour trouver ses parties et ses chapitres, au lieu d'une liste de
 * supports où le plus récent chassait le précédent.
 */
export default async function CoursPage() {
  const modules = await getMesModulesCours();

  if (modules.length === 0) {
    return (
      <EnConstruction
        titre="Aucun cours"
        description="Les supports de cours et les énoncés de TP remis par votre formateur apparaîtront ici, rangés par module."
        Icone={BookOpen}
      />
    );
  }

  return <ListeModules modules={modules} />;
}
