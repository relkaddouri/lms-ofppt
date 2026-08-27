import { getSeancesByGroupe, type Seance } from "@/app/actions/seances";
import { getGroupeModules } from "@/app/actions/groupes";
import ModuleProgression, { type ObjectifBloc } from "./ModuleProgression";
import PlanifierSeance from "./PlanifierSeance";
import Card from "@/components/ui/Card";
import { CalendarDays } from "lucide-react";

export default async function ProgressionPage({
  params,
}: PageProps<"/groupes/[id]/progression">) {
  const { id } = await params;
  const [seances, modules] = await Promise.all([
    getSeancesByGroupe(id),
    getGroupeModules(id),
  ]);

  // Deux niveaux de regroupement : le module, puis l'objectif d'apprentissage.
  // Sans le second, trois séances du même objectif se suivent à l'identique.
  const parModule = new Map<
    string,
    {
      nom: string;
      code: string | null;
      masseHoraire: number | null;
      seances: Seance[];
      objectifs: Map<string, ObjectifBloc>;
    }
  >();

  for (const s of seances) {
    if (!parModule.has(s.module_id)) {
      const info = modules.find((m) => m.module_id === s.module_id);
      parModule.set(s.module_id, {
        nom: s.modules?.nom ?? info?.nom ?? "Module",
        code: info?.code_operationnel ?? null,
        masseHoraire: info?.masse_horaire_allouee ?? null,
        seances: [],
        objectifs: new Map(),
      });
    }
    const m = parModule.get(s.module_id)!;
    m.seances.push(s);

    const cle = s.suggestions_pedagogiques?.code ?? "—";
    if (!m.objectifs.has(cle)) {
      m.objectifs.set(cle, {
        code: cle,
        intitule:
          s.suggestions_pedagogiques?.apprentissage_base ??
          s.objectif_operationnel ??
          "Séances hors plan",
        seances: [],
      });
    }
    m.objectifs.get(cle)!.seances.push(s);
  }

  // Le module en cours s'ouvre seul : c'est celui sur lequel le formateur
  // travaille, les autres restent repliés.
  const premierEnCours = [...parModule.entries()].find(([, m]) =>
    m.seances.some((s) => s.statut !== "fait"),
  )?.[0];

  return (
    <>
      <div className="mt-6 flex items-center justify-between gap-4">
        <p className="text-sm text-slate">
          {seances.length} séance{seances.length > 1 ? "s" : ""} sur{" "}
          {parModule.size} module{parModule.size > 1 ? "s" : ""}
        </p>
        <PlanifierSeance groupeId={id} modules={modules} />
      </div>

      {seances.length === 0 ? (
        <Card className="mt-6 p-10 text-center" padded={false}>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-mint">
            <CalendarDays className="h-6 w-6 text-forest" aria-hidden />
          </div>
          <p className="mt-4 text-sm font-medium text-ink">
            Aucune séance planifiée
          </p>
          <p className="mt-1 text-sm text-slate">
            {modules.length === 0
              ? "Assignez d'abord des modules à ce groupe depuis l'onglet Modules."
              : "Générez le plan de déroulement d'un module depuis l'onglet Modules, ou planifiez une séance isolée."}
          </p>
        </Card>
      ) : (
        <div className="mt-4 space-y-3">
          {[...parModule.entries()].map(([moduleId, m]) => (
            <ModuleProgression
              key={moduleId}
              groupeId={id}
              moduleId={moduleId}
              nom={m.nom}
              code={m.code}
              masseHoraire={m.masseHoraire}
              objectifs={[...m.objectifs.values()]}
              seances={m.seances}
              ouvertParDefaut={moduleId === premierEnCours}
            />
          ))}
        </div>
      )}
    </>
  );
}
