import { getSeancesByGroupe, type Seance } from "@/app/actions/seances";
import { getGroupeModules } from "@/app/actions/groupes";
import SeanceCard from "./SeanceCard";
import NouvelleSeanceForm from "./NouvelleSeanceForm";
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

  const parModule = new Map<
    string,
    { nom: string; code: string | null; seances: Seance[] }
  >();
  for (const s of seances) {
    if (!parModule.has(s.module_id)) {
      const info = modules.find((m) => m.module_id === s.module_id);
      parModule.set(s.module_id, {
        nom: s.modules?.nom ?? info?.nom ?? "Module",
        code: info?.code_operationnel ?? null,
        seances: [],
      });
    }
    parModule.get(s.module_id)!.seances.push(s);
  }

  return (
    <>
      <NouvelleSeanceForm groupeId={id} modules={modules} />

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
              : "Utilisez le formulaire ci-dessus pour planifier votre première séance."}
          </p>
        </Card>
      ) : (
        <div className="mt-8 space-y-8">
          {[...parModule.entries()].map(([moduleId, m]) => (
            <section key={moduleId}>
              <div className="flex flex-wrap items-baseline gap-2">
                {m.code ? (
                  <span className="font-mono text-sm font-medium text-forest">
                    {m.code}
                  </span>
                ) : null}
                <h2 className="font-display text-xl font-bold text-ink">
                  {m.nom}
                </h2>
                <span className="text-xs text-slate">
                  {m.seances.length} séance{m.seances.length > 1 ? "s" : ""}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {m.seances.map((s) => (
                  <SeanceCard key={s.id} seance={s} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
