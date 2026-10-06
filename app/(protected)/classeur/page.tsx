import { getGroupesClasseur } from "@/app/actions/classeur";
import { getEtablissement } from "@/app/actions/etablissement";
import ClasseurExport from "./ClasseurExport";
import CahierExport from "./CahierExport";

export const metadata = { title: "Classeur pédagogique" };

export default async function ClasseurPage() {
  // Deux lectures sur une page qu'on ouvre pour éditer un document, pas pour
  // la consulter : elles partent ensemble plutôt que l'une après l'autre.
  const [groupes, etablissement] = await Promise.all([
    getGroupesClasseur(),
    getEtablissement(),
  ]);

  return (
    // Cette page ne portait aucune marge : son titre touchait le bord de
    // l'écran, sur mobile comme ailleurs.
    <div className="flex flex-col gap-6 px-4 py-8 md:px-10 md:py-10">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-[26px] font-bold tracking-[-0.02em] text-ink">
          Classeur pédagogique
        </h1>
        <p className="text-[15px] text-slate-2">
          Les deux documents que vous remettez : le cahier du formateur, et vos
          fiches de préparation reliées.
        </p>
      </div>

      <CahierExport etablissement={etablissement} />

      <div className="flex flex-col gap-1.5">
        <h2 className="font-display text-[19px] font-semibold text-ink">
          Fiches de préparation reliées
        </h2>
        <p className="text-[15px] text-slate-2">
          Vos fiches en un seul PDF. Par défaut tous les groupes et tous les
          modules, sur la période de votre choix.
        </p>
      </div>

      <ClasseurExport groupes={groupes} />
    </div>
  );
}
