import { CalendarDays } from "lucide-react";
import EnConstruction from "../EnConstruction";

export const metadata = { title: "Emploi du temps" };

export default function EmploiDuTempsPage() {
  return (
    <EnConstruction
      titre="Emploi du temps"
      description="Vos séances et les dates de contrôle de votre groupe."
      Icone={CalendarDays}
    />
  );
}
