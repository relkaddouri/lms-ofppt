import { getSeancesByGroupe, type Seance } from "@/app/actions/seances";
import { getGroupeModules } from "@/app/actions/groupes";
import { getRappelsControle } from "@/app/actions/rappels";
import {
  getControlesDuGroupe,
  type ControleProgression,
} from "@/app/actions/controles";
import ModuleProgression, { type ObjectifBloc } from "./ModuleProgression";
import PlanifierSeance from "./PlanifierSeance";
import SuiviSeances from "./SuiviSeances";
import Card from "@/components/ui/Card";
import { CalendarDays } from "lucide-react";

export default async function ProgressionPage({
  params,
}: PageProps<"/groupes/[id]/progression">) {
  const { id } = await params;
  const [seances, modules, rappels, controles] = await Promise.all([
    getSeancesByGroupe(id),
    getGroupeModules(id),
    getRappelsControle(id),
    getControlesDuGroupe(id),
  ]);

  // Le rappel a besoin du nombre de contrôles réellement posés, que la liste
  // des séances ne connaît pas.
  const couverts = new Map(
    rappels.map((r) => [r.module_id, r.rappel.couverts]),
  );

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

  // Chaque contrôle se range sous la dernière séance qui l'a précédé : c'est
  // là qu'il a eu lieu dans le déroulement, et c'est ce que le formateur
  // cherche en regardant sa progression (demande du 28/09/2026). Le calcul se
  // fait ici, une fois, plutôt que dans chaque bloc de module.
  const controlesApres = new Map<string, ControleProgression[]>();
  const sansAncrage = new Map<string, ControleProgression[]>();

  for (const c of controles) {
    const liste = parModule.get(c.module_id);
    const jour = c.date_prevue;
    // Les séances arrivent triées par date : la dernière qui précède le
    // contrôle est la plus tardive qui ne lui soit pas postérieure.
    const ancre = jour
      ? [...(liste?.seances ?? [])]
          .reverse()
          .find((s) => s.date !== null && s.date <= jour)
      : undefined;

    if (ancre) {
      const dejala = controlesApres.get(ancre.id) ?? [];
      dejala.push(c);
      controlesApres.set(ancre.id, dejala);
    } else if (liste) {
      const dejala = sansAncrage.get(c.module_id) ?? [];
      dejala.push(c);
      sansAncrage.set(c.module_id, dejala);
    }
    // Un contrôle dont le module n'a aucune séance dans ce groupe n'a pas de
    // place dans cette progression : il s'affiche depuis l'onglet Contrôles.
  }

  // Le module en cours s'ouvre seul : c'est celui sur lequel le formateur
  // travaille, les autres restent repliés.
  const premierEnCours = [...parModule.entries()].find(([, m]) =>
    m.seances.some((s) => s.statut !== "fait"),
  )?.[0];

  const faites = seances.filter((s) => s.statut === "fait").length;

  return (
    <div className="flex flex-col gap-6 pt-8">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[11.5px] uppercase tracking-[0.12em] text-slate-light">
            Plan de déroulement
          </span>
          <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.02em] text-ink">
            Suivi des séances
          </h1>
          <p className="text-[15px] text-slate-2">
            <span className="font-mono text-body">{seances.length}</span> séance
            {seances.length > 1 ? "s" : ""} sur{" "}
            <span className="font-mono text-body">{parModule.size}</span> module
            {parModule.size > 1 ? "s" : ""} ·{" "}
            <span className="font-mono text-body">{faites}</span> faite
            {faites > 1 ? "s" : ""}
          </p>
        </div>
        <PlanifierSeance groupeId={id} modules={modules} />
      </header>

      {seances.length === 0 ? (
        <Card className="p-10 text-center" padded={false}>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-wash">
            <CalendarDays className="h-6 w-6 text-ink" aria-hidden />
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
        <SuiviSeances
          groupeId={id}
          seances={seances}
          enfants={
            <div className="flex flex-col gap-3">
              {[...parModule.entries()].map(([moduleId, m]) => (
            <ModuleProgression
              key={moduleId}
              groupeId={id}
              moduleId={moduleId}
              nom={m.nom}
              code={m.code}
              masseHoraire={m.masseHoraire}
              controlesCouverts={couverts.get(moduleId) ?? 0}
              objectifs={[...m.objectifs.values()]}
              seances={m.seances}
              controlesApres={Object.fromEntries(
                m.seances
                  .filter((s) => controlesApres.has(s.id))
                  .map((s) => [s.id, controlesApres.get(s.id)!]),
              )}
              controlesSansAncrage={sansAncrage.get(moduleId) ?? []}
                  ouvertParDefaut={moduleId === premierEnCours}
                />
              ))}
            </div>
          }
        />
      )}
    </div>
  );
}
