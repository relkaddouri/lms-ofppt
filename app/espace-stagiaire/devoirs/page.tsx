import { ClipboardList } from "lucide-react";
import { getMesDevoirs } from "@/app/actions/devoirs";
import CarteDevoir from "./CarteDevoir";
import EnConstruction from "../EnConstruction";

export const metadata = { title: "Devoirs" };

export default async function DevoirsPage() {
  const devoirs = await getMesDevoirs();

  if (devoirs.length === 0) {
    return (
      <EnConstruction
        titre="Aucun devoir"
        description="Les devoirs assignés par votre formateur apparaîtront ici, avec leur date de rendu."
        Icone={ClipboardList}
      />
    );
  }

  // Ce qui reste à faire d'abord : un devoir déjà remis n'appelle plus d'action.
  const aFaire = devoirs.filter((d) => d.monRendu?.statut !== "rendu");
  const remis = devoirs.filter((d) => d.monRendu?.statut === "rendu");

  return (
    <div className="space-y-4">
      {aFaire.length > 0 ? (
        <section className="overflow-hidden rounded-[14px] border border-border bg-surface">
          {aFaire.map((d) => (
            <CarteDevoir key={d.id} devoir={d} />
          ))}
        </section>
      ) : null}

      {remis.length > 0 ? (
        <section>
          <h2 className="px-1 text-sm font-medium text-slate">
            Devoirs remis ({remis.length})
          </h2>
          <div className="mt-2 overflow-hidden rounded-[14px] border border-border bg-surface">
            {remis.map((d) => (
              <CarteDevoir key={d.id} devoir={d} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
