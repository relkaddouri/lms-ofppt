import { ClipboardList } from "lucide-react";
import EnConstruction from "../EnConstruction";

export const metadata = { title: "Devoirs" };

export default function DevoirsPage() {
  return (
    <EnConstruction
      titre="Devoirs"
      description="Les devoirs assignés par votre formateur, avec leur date de rendu."
      Icone={ClipboardList}
    />
  );
}
