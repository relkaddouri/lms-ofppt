import { getGroupesClasseur } from "@/app/actions/classeur";
import ClasseurExport from "./ClasseurExport";

export const metadata = { title: "Classeur pédagogique" };

export default async function ClasseurPage() {
  const groupes = await getGroupesClasseur();

  return (
    // Cette page ne portait aucune marge : son titre touchait le bord de
    // l'écran, sur mobile comme ailleurs.
    <div className="flex flex-col gap-6 px-4 py-8 md:px-10 md:py-10">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-[26px] font-bold tracking-[-0.02em] text-ink">
          Classeur pédagogique
        </h1>
        <p className="text-[15px] text-slate-2">
          Le document que vous remettez : vos fiches de préparation reliées en
          un seul PDF, dans la forme attendue du cahier du formateur. Par
          défaut tous les groupes et tous les modules, sur la période de votre
          choix.
        </p>
      </div>

      <ClasseurExport groupes={groupes} />
    </div>
  );
}
